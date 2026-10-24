import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./config";
import { createNotification } from "./notifications";
import type { SeriousCase } from "../../types/seriousCase";
import type { UserProfile } from "../../types/user";

const seriousCasesCollection = collection(db, "seriousCases");

function toSeriousCase(id: string, data: Record<string, unknown>): SeriousCase {
  return { id, ...data } as SeriousCase;
}

/** Files a new case for a booking — resolving which admin(s) are responsible
    (college-scoped Principal/Vice-Principal, with a fallback chain) requires
    scanning the whole admin population, which only the Cloud Function (Admin
    SDK) can do; this is a thin callable wrapper, same pattern as
    createCampusLogin/createAdminLogin. */
export async function createSeriousCase(bookingId: string, note: string): Promise<string> {
  const fn = httpsCallable<{ bookingId: string; note: string }, { success: boolean; caseId: string }>(
    functions,
    "createSeriousCase",
  );
  const result = await fn({ bookingId, note });
  return result.data.caseId;
}

/** One case per booking (doc id === bookingId) — used to show its status
    inline wherever a booking is viewed. */
export async function getSeriousCaseForBooking(bookingId: string): Promise<SeriousCase | null> {
  const snap = await getDoc(doc(db, "seriousCases", bookingId));
  return snap.exists() ? toSeriousCase(snap.id, snap.data()) : null;
}

/** Management retains platform-wide read-only oversight. Administration is
    limited to assigned colleges; Principals/VPs see explicitly assigned cases. */
export function subscribeToAdminSeriousCases(
  admin: Pick<UserProfile, "uid" | "adminAccess">,
  onChange: (cases: SeriousCase[]) => void,
): Unsubscribe {
  const access = admin.adminAccess;
  const isCollegeReviewer =
    access?.scope === "campuses" &&
    (access.designation === "principal" || access.designation === "vice-principal");
  const isAdministration = access?.designation === "administration";
  const seesEverything =
    !access ||
    (access.scope === "global" && !isAdministration) ||
    access.designation === "management";

  if (seesEverything) {
    const q = query(seriousCasesCollection, orderBy("createdAt", "desc"));
    return onSnapshot(
      q,
      (snap) => onChange(snap.docs.map((d) => toSeriousCase(d.id, d.data()))),
      (error) => {
        console.error("Failed to subscribe to serious cases:", error);
        onChange([]);
      },
    );
  }

  if (isAdministration && access?.scope === "campuses") {
    const campusIds = access.campusIds ?? [];
    const collegeIds = access.collegeIds ?? [];
    if (campusIds.length === 0 || collegeIds.length === 0) {
      onChange([]);
      return () => {};
    }

    const collegeChunks = Array.from(
      { length: Math.ceil(collegeIds.length / 30) },
      (_, index) => collegeIds.slice(index * 30, (index + 1) * 30),
    );
    const assignedQueries = campusIds.flatMap((campusId) =>
      collegeChunks.map((collegeChunk) =>
        query(
          seriousCasesCollection,
          where("campusId", "==", campusId),
          where("collegeId", "in", collegeChunk),
        ),
      ),
    );
    const casesByQuery = new Map<number, Map<string, SeriousCase>>();
    const emitCombined = () => {
      const merged = new Map<string, SeriousCase>();
      for (const cases of casesByQuery.values()) {
        for (const [id, seriousCase] of cases) merged.set(id, seriousCase);
      }
      onChange(Array.from(merged.values()).sort((a, b) => b.createdAt - a.createdAt));
    };
    const unsubscribes = assignedQueries.map((assignedQuery, index) =>
      onSnapshot(
        assignedQuery,
        (snap) => {
          casesByQuery.set(index, new Map(snap.docs.map((d) => [d.id, toSeriousCase(d.id, d.data())])));
          emitCombined();
        },
        (error) => {
          console.error("Failed to subscribe to assigned Administration cases:", error);
          onChange([]);
        },
      ),
    );

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }

  if (isCollegeReviewer) {
    const q = query(seriousCasesCollection, where("targetAdminUids", "array-contains", admin.uid));
    return onSnapshot(
      q,
      (snap) =>
        onChange(
          snap.docs
            .map((d) => toSeriousCase(d.id, d.data()))
            .sort((a, b) => b.createdAt - a.createdAt),
        ),
      (error) => {
        console.error("Failed to subscribe to assigned serious cases:", error);
        onChange([]);
      },
    );
  }

  const collegeIds = access?.collegeIds ?? [];

  if (collegeIds.length > 0) {
    const collegeQuery = query(seriousCasesCollection, where("collegeId", "in", collegeIds.slice(0, 30)));
    const uidQuery = query(seriousCasesCollection, where("targetAdminUids", "array-contains", admin.uid));

    let casesByCollege = new Map<string, SeriousCase>();
    let casesByUid = new Map<string, SeriousCase>();

    const emitCombined = () => {
      const merged = new Map<string, SeriousCase>([...casesByCollege, ...casesByUid]);
      const list = Array.from(merged.values()).sort((a, b) => b.createdAt - a.createdAt);
      onChange(list);
    };

    const unsubCollege = onSnapshot(collegeQuery, (snap) => {
      casesByCollege = new Map(snap.docs.map((d) => [d.id, toSeriousCase(d.id, d.data())]));
      emitCombined();
    });
    const unsubUid = onSnapshot(uidQuery, (snap) => {
      casesByUid = new Map(snap.docs.map((d) => [d.id, toSeriousCase(d.id, d.data())]));
      emitCombined();
    });

    return () => {
      unsubCollege();
      unsubUid();
    };
  }

  const q = query(seriousCasesCollection, where("targetAdminUids", "array-contains", admin.uid), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => onChange(snap.docs.map((d) => toSeriousCase(d.id, d.data()))));
}

/** Only the specifically-targeted admin may resolve a case — enforced by
    firestore.rules, not just this function. Write-once: a case that already
    has an actionTaken can't be overwritten. */
export async function recordActionTaken(
  seriousCase: SeriousCase,
  text: string,
  by: { uid: string; email: string },
): Promise<void> {
  const now = Date.now();
  await updateDoc(doc(db, "seriousCases", seriousCase.id), {
    actionTaken: { text: text.trim(), byUid: by.uid, byEmail: by.email, at: now },
    status: "resolved",
    updatedAt: now,
  });
  await createNotification({
    recipientId: seriousCase.authorUid,
    type: "serious_case_resolved",
    bookingId: seriousCase.bookingId,
    title: "Your flagged case was reviewed",
    message: `Action has been taken on the case you flagged for ${seriousCase.studentEmail}.`,
  });
}

/** Logged by the targeted admin during an overdue (post-24h) escalation —
    explains the delay without resolving the case; it keeps re-escalating
    every 24h until recordActionTaken is eventually called. */
export async function recordDelayReason(
  seriousCase: SeriousCase,
  text: string,
  by: { uid: string; email: string },
): Promise<void> {
  const now = Date.now();
  await updateDoc(doc(db, "seriousCases", seriousCase.id), {
    escalations: arrayUnion({ type: "delay-reason", at: now, text: text.trim(), byUid: by.uid, byEmail: by.email }),
    updatedAt: now,
  });
}
