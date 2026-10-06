import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldPath } from "firebase-admin/firestore";

initializeApp();

const auth = getAuth();
const db = getFirestore();

function isCampusManagerRole(role: unknown): boolean {
  return role === "admin" || role === "super-admin";
}

interface DeleteCampusLoginRequest {
  uid: string;
}

export const deleteCampusLogin = onCall<DeleteCampusLoginRequest>(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const callerDoc = await db.collection("users").doc(callerUid).get();
  if (!isCampusManagerRole(callerDoc.data()?.role)) {
    throw new HttpsError("permission-denied", "Only an Admin or Super Admin can delete a campus login.");
  }

  const targetUid = request.data.uid;
  if (!targetUid || typeof targetUid !== "string") {
    throw new HttpsError("invalid-argument", "A target uid is required.");
  }

  await auth.deleteUser(targetUid);
  await db.collection("users").doc(targetUid).delete();

  return { success: true };
});

interface CreateCampusLoginRequest {
  email: string;
  password: string;
  displayName: string;
  role: "counsellor" | "head";
  campusId: string;
  collegeId: string;
}

export const createCampusLogin = onCall<CreateCampusLoginRequest>(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const callerDoc = await db.collection("users").doc(callerUid).get();
  if (!isCampusManagerRole(callerDoc.data()?.role)) {
    throw new HttpsError("permission-denied", "Only an Admin or Super Admin can create a campus login.");
  }

  const { email, password, displayName, role, campusId, collegeId } = request.data;
  if (!email || !password || !displayName || !campusId || !collegeId) {
    throw new HttpsError("invalid-argument", "Email, password, display name, campus, and college are required.");
  }
  if (role !== "counsellor" && role !== "head") {
    throw new HttpsError("invalid-argument", "Role must be counsellor or head.");
  }

  if (role === "head") {
    const headSnapshot = await db
      .collection("users")
      .where("campusId", "==", campusId)
      .where("role", "==", "head")
      .get();
    if (!headSnapshot.empty) {
      throw new HttpsError("already-exists", "This campus already has a Head.");
    }
  }

  const userRecord = await auth.createUser({ email, password, displayName });
  try {
    await db.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      displayName,
      role,
      campusId,
      collegeId,
      createdAt: Date.now(),
    });
  } catch (err) {
    await auth.deleteUser(userRecord.uid);
    throw err;
  }

  return { success: true, uid: userRecord.uid };
});

interface CreateStudentLoginRequest {
  email: string;
  collegeId: string;
}

const STUDENT_DEFAULT_PASSWORD = "123456";

export const createStudentLogin = onCall<CreateStudentLoginRequest>(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const callerDoc = await db.collection("users").doc(callerUid).get();
  const callerData = callerDoc.data();
  if (callerData?.role !== "head" || !callerData?.campusId) {
    throw new HttpsError("permission-denied", "Only a Head with a campus can import student logins.");
  }
  const campusId = callerData.campusId as string;

  const { email, collegeId } = request.data;
  if (!email || !collegeId) {
    throw new HttpsError("invalid-argument", "Email and college are required.");
  }

  const collegeDoc = await db.collection("colleges").doc(collegeId).get();
  if (!collegeDoc.exists || collegeDoc.data()?.campusId !== campusId) {
    throw new HttpsError("invalid-argument", "That college does not belong to your campus.");
  }

  const userRecord = await auth.createUser({ email, password: STUDENT_DEFAULT_PASSWORD });
  try {
    await db.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      role: "user",
      campusId,
      collegeId,
      createdAt: Date.now(),
    });
  } catch (err) {
    await auth.deleteUser(userRecord.uid);
    throw err;
  }

  return { success: true, uid: userRecord.uid };
});

interface UpdateCampusLoginRequest {
  uid: string;
  displayName: string;
  email: string;
  password?: string;
  role: "counsellor" | "head";
  collegeId: string;
}

export const updateCampusLogin = onCall<UpdateCampusLoginRequest>(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const callerDoc = await db.collection("users").doc(callerUid).get();
  if (!isCampusManagerRole(callerDoc.data()?.role)) {
    throw new HttpsError("permission-denied", "Only an Admin or Super Admin can edit a campus login.");
  }

  const { uid, displayName, email, password, role, collegeId } = request.data;
  if (!uid || typeof uid !== "string") {
    throw new HttpsError("invalid-argument", "A target uid is required.");
  }

  const targetDoc = await db.collection("users").doc(uid).get();
  const campusId = targetDoc.data()?.campusId;

  if (role === "head" && campusId) {
    const headSnapshot = await db
      .collection("users")
      .where("campusId", "==", campusId)
      .where("role", "==", "head")
      .get();
    const hasOtherHead = headSnapshot.docs.some((d) => d.id !== uid);
    if (hasOtherHead) {
      throw new HttpsError("already-exists", "This campus already has a Head.");
    }
  }

  await auth.updateUser(uid, {
    email,
    displayName,
    ...(password ? { password } : {}),
  });

  await db.collection("users").doc(uid).update({ displayName, email, role, collegeId });

  return { success: true };
});

// ── Community feed (server-side) ───────────────────────────────────────────
// The anonymous community feed is intentionally NOT read via the client SDK:
// the whole-collection scan + per-post author resolution would not scale to a
// 7-campus deployment, and identity must only ever be attached server-side for
// the viewer's own campus Head/Counsellor. These callables paginate the
// campus-scoped feed and cache resolved identities in memory.

const MAX_FEED_PAGE = 50;
const MAX_COMMENT_PAGE = 100;
const IDENTITY_CACHE_MAX = 5000;
const identityCache = new Map<string, { name: string; email: string }>();

interface CommunityCursor {
  createdAt: number;
  id: string;
}

function canSeeCommunityAuthor(role: unknown): boolean {
  return role === "head" || role === "counsellor";
}

async function resolveCommunityAuthor(
  authorId: string | undefined,
): Promise<{ name: string; email: string } | null> {
  if (!authorId) return null;
  const cached = identityCache.get(authorId);
  if (cached) return cached;
  const snap = await db.collection("users").doc(authorId).get();
  const data = snap.data();
  if (!data) return null;
  const identity = {
    name: (data.displayName as string) || (data.email as string) || "Anonymous",
    email: (data.email as string) || "",
  };
  if (identityCache.size >= IDENTITY_CACHE_MAX) identityCache.clear();
  identityCache.set(authorId, identity);
  return identity;
}

async function readCommunityCaller(request: {
  auth?: { uid?: string } | null;
}): Promise<{ callerUid: string; role: string | null; campusId: string | null }> {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "You must be signed in.");
  const userDoc = await db.collection("users").doc(callerUid).get();
  const user = userDoc.data();
  if (!user) throw new HttpsError("unauthenticated", "Your account profile was not found.");
  return {
    callerUid,
    role: (user.role as string) ?? null,
    campusId: (user.campusId as string) ?? null,
  };
}

export const getCommunityFeed = onCall<{
  cursor?: CommunityCursor | null;
  limit?: number;
}>(async (request) => {
  const { campusId, role } = await readCommunityCaller(request);
  if (!campusId) {
    throw new HttpsError("permission-denied", "Your account is not linked to a campus.");
  }
  const pageSize = Math.min(Math.max(request.data?.limit ?? 20, 1), MAX_FEED_PAGE);

  let query: FirebaseFirestore.Query = db
    .collection("communityPosts")
    .where("campusId", "==", campusId)
    .orderBy("createdAt", "desc")
    .orderBy(FieldPath.documentId(), "desc")
    .limit(pageSize + 1);

  if (request.data?.cursor) {
    query = query.startAfter([request.data.cursor.createdAt, request.data.cursor.id]);
  }

  const snapshot = await query.get();
  const docs = snapshot.docs;
  const hasMore = docs.length > pageSize;
  const pageDocs = docs.slice(0, pageSize);
  const moderator = canSeeCommunityAuthor(role);

  const posts = await Promise.all(
    pageDocs.map(async (docRef) => {
      const data = docRef.data();
      const post: Record<string, unknown> = {
        id: docRef.id,
        text: data.text,
        likeCount: data.likeCount,
        commentCount: data.commentCount,
        createdAt: data.createdAt,
        campusId: data.campusId,
        pinned: data.pinned ?? false,
      };
      if (!moderator) return post as FirebaseFirestore.DocumentData;

      const authorSnap = await docRef.ref.collection("private").doc("author").get();
      const identity = await resolveCommunityAuthor(authorSnap.data()?.authorId as string | undefined);
      if (identity) {
        post.authorName = identity.name;
        post.authorEmail = identity.email;
      }
      return post as FirebaseFirestore.DocumentData;
    }),
  );

  const last = pageDocs[pageDocs.length - 1]?.data();
  return {
    posts,
    hasMore,
    nextCursor: pageDocs.length > 0 && last ? { createdAt: last.createdAt as number, id: pageDocs[pageDocs.length - 1].id } : null,
  };
});

export const getCommentFeed = onCall<{
  postId: string;
  cursor?: CommunityCursor | null;
  limit?: number;
}>(async (request) => {
  const { campusId, role } = await readCommunityCaller(request);
  const postId = request.data?.postId;
  if (!postId || typeof postId !== "string") {
    throw new HttpsError("invalid-argument", "postId is required.");
  }

  const postSnap = await db.collection("communityPosts").doc(postId).get();
  if (!postSnap.exists) {
    throw new HttpsError("not-found", "Post not found.");
  }
  if (postSnap.data()?.campusId !== campusId) {
    throw new HttpsError("permission-denied", "This post does not belong to your campus.");
  }

  const pageSize = Math.min(Math.max(request.data?.limit ?? 50, 1), MAX_COMMENT_PAGE);
  let query: FirebaseFirestore.Query = db
    .collection("communityPosts")
    .doc(postId)
    .collection("comments")
    .orderBy("createdAt", "asc")
    .orderBy(FieldPath.documentId(), "asc")
    .limit(pageSize + 1);

  if (request.data?.cursor) {
    query = query.startAfter([request.data.cursor.createdAt, request.data.cursor.id]);
  }

  const snapshot = await query.get();
  const docs = snapshot.docs;
  const hasMore = docs.length > pageSize;
  const pageDocs = docs.slice(0, pageSize);
  const moderator = canSeeCommunityAuthor(role);

  const comments = await Promise.all(
    pageDocs.map(async (docRef) => {
      const data = docRef.data();
      const comment: Record<string, unknown> = {
        id: docRef.id,
        postId: data.postId,
        text: data.text,
        createdAt: data.createdAt,
      };
      if (!moderator) return comment as FirebaseFirestore.DocumentData;

      const authorSnap = await docRef.ref.collection("private").doc("author").get();
      const identity = await resolveCommunityAuthor(authorSnap.data()?.authorId as string | undefined);
      if (identity) {
        comment.authorName = identity.name;
        comment.authorEmail = identity.email;
      }
      return comment as FirebaseFirestore.DocumentData;
    }),
  );

  const last = pageDocs[pageDocs.length - 1];
  return {
    comments,
    hasMore,
    nextCursor: last ? { createdAt: last.data().createdAt as number, id: last.id } : null,
  };
});

// A counsellor's public rating/reviews, shown on their profile before anyone
// books them. `bookings` docs are private to their two parties + staff (so a
// stranger can't learn who someone else booked or what was discussed) — a
// direct client-side query for "all of this counsellor's completed sessions"
// is rejected outright by the security rules, for anyone but the counsellor
// themselves or staff. This runs with admin access and hands back only the
// rating and review text, never the booking's owner or any other detail.
export const getCounsellorReviews = onCall<{ counsellorId: string }>(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }
  const counsellorId = request.data?.counsellorId;
  if (!counsellorId || typeof counsellorId !== "string") {
    throw new HttpsError("invalid-argument", "counsellorId is required.");
  }

  const snapshot = await db
    .collection("bookings")
    .where("counsellorId", "==", counsellorId)
    .where("status", "==", "completed")
    .get();

  const reviews = snapshot.docs
    .map((docRef) => docRef.data())
    .filter((b) => b.outcome !== "missed" && typeof b.userRatingOfCounsellor === "number")
    .map((b) => ({
      rating: b.userRatingOfCounsellor as number,
      reviewText: typeof b.userReviewText === "string" ? b.userReviewText : "",
    }));

  return { reviews };
});

// Session length for a normal (non-emergency, non-offline-import) booking —
// mirrors SESSION_DURATION_MINUTES in src/services/firebase/bookings.ts.
const SESSION_DURATION_MINUTES = 90;
const ACTIVE_BOOKING_STATUSES = ["pending", "accepted", "scheduled"];

interface BookingIntakeInput {
  username: string;
  occupation: "student" | "professional";
  whatsappNumber: string;
  issue: string;
}

const CONCERN_CATEGORIES = ["anxiety", "academic-stress", "relationships", "sleep", "self-esteem", "other"];

// Creates a normal session request. This is the ONLY way a client can create
// a non-emergency booking now — firestore.rules no longer lets a client
// write bookings/{id} directly with userId == themselves for anything but an
// emergency SOS (see createEmergencySosBooking, deliberately untouched and
// still a direct client write). The one thing this adds that a rules-only
// check can't: refusing a second active booking for the same student. A
// disabled button in the UI was the only thing enforcing that before, so it
// only held as long as nobody had two tabs open, a stale page, or any other
// path that skipped the button.
export const createBooking = onCall<{
  counsellorId: string;
  counsellorEmail: string;
  intake: BookingIntakeInput;
  proposedSlots: [number, number];
  campusId?: string;
  concernCategories?: string[];
}>(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const data = request.data;
  const intake = data?.intake;
  if (
    !data?.counsellorId ||
    typeof data.counsellorId !== "string" ||
    !data.counsellorEmail ||
    typeof data.counsellorEmail !== "string" ||
    !Array.isArray(data.proposedSlots) ||
    data.proposedSlots.length !== 2 ||
    !data.proposedSlots.every((t) => typeof t === "number") ||
    !intake ||
    !intake.username?.trim() ||
    !["student", "professional"].includes(intake.occupation) ||
    !intake.whatsappNumber?.trim() ||
    !intake.issue?.trim()
  ) {
    throw new HttpsError("invalid-argument", "Missing or invalid booking details.");
  }
  if (
    data.concernCategories !== undefined &&
    (!Array.isArray(data.concernCategories) || !data.concernCategories.every((c) => CONCERN_CATEGORIES.includes(c)))
  ) {
    throw new HttpsError("invalid-argument", "Invalid concern category.");
  }

  const callerSnap = await db.collection("users").doc(callerUid).get();
  const caller = callerSnap.data();
  if (!caller) {
    throw new HttpsError("unauthenticated", "Your account profile was not found.");
  }
  const callerEmail = (caller.email as string) || "";

  // One active booking per student, same rule the UI already tried to show —
  // now actually guaranteed. A "scheduled" session whose time has already
  // passed doesn't block a new one (mirrors isSessionEndedPending()
  // client-side — it just hasn't been formally closed yet).
  const existing = await db
    .collection("bookings")
    .where("userId", "==", callerUid)
    .where("status", "in", ACTIVE_BOOKING_STATUSES)
    .get();

  const now = Date.now();
  const stillActive = existing.docs.some((docRef) => {
    const b = docRef.data();
    if (b.status === "scheduled" && typeof b.scheduledAt === "number") {
      const durationMinutes = typeof b.durationMinutes === "number" ? b.durationMinutes : SESSION_DURATION_MINUTES;
      return now < b.scheduledAt + durationMinutes * 60000;
    }
    return true;
  });

  if (stillActive) {
    throw new HttpsError(
      "already-exists",
      "You already have an active booking. Cancel it or wait for it to finish before booking another.",
    );
  }

  const bookingRef = db.collection("bookings").doc();
  await bookingRef.set({
    userId: callerUid,
    userEmail: callerEmail,
    counsellorId: data.counsellorId,
    counsellorEmail: data.counsellorEmail,
    status: "pending",
    durationMinutes: SESSION_DURATION_MINUTES,
    proposedSlots: data.proposedSlots,
    ...(data.campusId ? { campusId: data.campusId } : {}),
    ...(data.concernCategories?.length ? { concernCategories: data.concernCategories } : {}),
    createdAt: now,
    updatedAt: now,
  });
  await bookingRef.collection("private").doc("details").set({
    username: intake.username.trim(),
    occupation: intake.occupation,
    whatsappNumber: intake.whatsappNumber.trim(),
    issue: intake.issue.trim(),
  });
  await db.collection("notifications").add({
    recipientId: data.counsellorId,
    type: "booking_requested",
    bookingId: bookingRef.id,
    title: "New session request",
    message: `${callerEmail} requested a session with you`,
    read: false,
    createdAt: now,
  });

  return { bookingId: bookingRef.id };
});

// Runs every 5 minutes and sends a one-time "starting now" notification to
// both the student and the counsellor, right at/after a scheduled session's
// start time. Firing on a clock rather than when someone happens to have the
// app open is why this has to be a scheduled function rather than
// client-side code. Each booking is flagged (reminderStartSent) so a run
// every 5 minutes can never send it twice.
export const sendSessionReminders = onSchedule("every 5 minutes", async () => {
  const now = Date.now();
  const snapshot = await db.collection("bookings").where("status", "==", "scheduled").get();

  const bookingUpdates: FirebaseFirestore.DocumentReference[] = [];
  const notifications: Record<string, unknown>[] = [];

  for (const docRef of snapshot.docs) {
    const b = docRef.data();
    const scheduledAt = b.scheduledAt as number | undefined;
    if (typeof scheduledAt !== "number" || b.reminderStartSent) continue;
    const durationMinutes = typeof b.durationMinutes === "number" ? b.durationMinutes : 90;
    if (now < scheduledAt || now >= scheduledAt + durationMinutes * 60000) continue;

    bookingUpdates.push(docRef.ref);
    const recipients = [
      { id: b.userId as string, counterpartEmail: b.counsellorEmail as string },
      { id: b.counsellorId as string, counterpartEmail: b.userEmail as string },
    ];
    for (const r of recipients) {
      notifications.push({
        recipientId: r.id,
        type: "session_reminder",
        bookingId: docRef.id,
        title: "Your session is starting now",
        message: `Your session with ${r.counterpartEmail} is starting now.`,
        read: false,
        createdAt: now,
      });
    }
  }

  if (bookingUpdates.length === 0 && notifications.length === 0) return;

  // Batched in chunks of 400 writes — comfortably under Firestore's 500-per-batch
  // limit even though each triggering booking contributes up to 3 writes (1 flag
  // update + 2 notifications).
  let batch = db.batch();
  let opsInBatch = 0;
  const batches: FirebaseFirestore.WriteBatch[] = [];
  function queue(op: () => void) {
    op();
    opsInBatch++;
    if (opsInBatch === 400) {
      batches.push(batch);
      batch = db.batch();
      opsInBatch = 0;
    }
  }
  for (const ref of bookingUpdates) queue(() => batch.update(ref, { reminderStartSent: true }));
  for (const n of notifications) queue(() => batch.set(db.collection("notifications").doc(), n));
  if (opsInBatch > 0) batches.push(batch);

  for (const b of batches) await b.commit();
});

// Runs every 15 minutes and flags sessions whose scheduled window has fully
// ended with nobody having closed them out (via closeMissedSession) — the
// same "needs review" nudge src/services/firebase/bookings.ts's
// flagMissedSessionPending sends, but that one only fires when a
// counsellor/head happens to have their Booking Requests dashboard open and
// refresh() runs. A student can otherwise be left staring at a passively
// computed "missed" label (isSessionEndedPending on the client) forever with
// no actual notification going out to anyone, if the counsellor never opens
// the app. This is the server-side backstop that fires regardless. Shares
// the same `missedNotified` flag as the client-side version so whichever
// runs first wins and the other is a no-op.
export const flagMissedSessions = onSchedule("every 15 minutes", async () => {
  const now = Date.now();
  const snapshot = await db.collection("bookings").where("status", "==", "scheduled").get();

  const bookingUpdates: FirebaseFirestore.DocumentReference[] = [];
  const notifications: Record<string, unknown>[] = [];
  const headByCampus = new Map<string, string | null>();

  async function resolveCampusHead(campusId: string, excludeUid: string): Promise<string | null> {
    if (headByCampus.has(campusId)) return headByCampus.get(campusId) ?? null;
    const headSnap = await db
      .collection("users")
      .where("role", "==", "head")
      .where("campusId", "==", campusId)
      .limit(2)
      .get();
    const head = headSnap.docs.map((d) => d.id).find((uid) => uid !== excludeUid) ?? null;
    headByCampus.set(campusId, head);
    return head;
  }

  for (const docRef of snapshot.docs) {
    const b = docRef.data();
    const scheduledAt = b.scheduledAt as number | undefined;
    if (typeof scheduledAt !== "number" || b.missedNotified) continue;
    const durationMinutes = typeof b.durationMinutes === "number" ? b.durationMinutes : 90;
    if (now < scheduledAt + durationMinutes * 60000) continue;

    const counsellorId = b.counsellorId as string;
    const userEmail = b.userEmail as string;
    bookingUpdates.push(docRef.ref);
    notifications.push({
      recipientId: counsellorId,
      type: "session_needs_review",
      bookingId: docRef.id,
      title: "Session needs review",
      message: `Your session with ${userEmail} was scheduled to end and hasn't been marked yet — let us know what happened.`,
      read: false,
      createdAt: now,
    });

    const campusId = b.campusId as string | undefined;
    if (campusId) {
      const headId = await resolveCampusHead(campusId, counsellorId);
      if (headId) {
        notifications.push({
          recipientId: headId,
          type: "session_needs_review",
          bookingId: docRef.id,
          title: "Counsellor session needs review",
          message: `${b.counsellorEmail ?? "A counsellor"}'s session with ${userEmail} was scheduled to end and hasn't been marked yet.`,
          read: false,
          createdAt: now,
        });
      }
    }
  }

  if (bookingUpdates.length === 0 && notifications.length === 0) return;

  let batch = db.batch();
  let opsInBatch = 0;
  const batches: FirebaseFirestore.WriteBatch[] = [];
  function queue(op: () => void) {
    op();
    opsInBatch++;
    if (opsInBatch === 400) {
      batches.push(batch);
      batch = db.batch();
      opsInBatch = 0;
    }
  }
  for (const ref of bookingUpdates) queue(() => batch.update(ref, { missedNotified: true }));
  for (const n of notifications) queue(() => batch.set(db.collection("notifications").doc(), n));
  if (opsInBatch > 0) batches.push(batch);

  for (const b of batches) await b.commit();
});


export { emailNotification } from "./email";
