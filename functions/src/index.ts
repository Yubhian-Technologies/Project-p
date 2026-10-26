import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldPath, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { randomUUID } from "crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

initializeApp();

const auth = getAuth();
const db = getFirestore();
const storage = getStorage();

// auth.createUser() throws a raw FirebaseAuthError on failure (e.g. a
// duplicate email) — left uncaught, that propagates as an unhandled
// rejection, which the client only ever sees as an opaque 500 with no
// explanation. This translates the common cases into a clean HttpsError with
// a message an admin can actually act on; anything else still propagates as
// before.
async function createAuthUser(params: {
  email: string;
  password: string;
  displayName?: string;
}): ReturnType<typeof auth.createUser> {
  try {
    return await auth.createUser(params);
  } catch (err) {
    const code = (err as { code?: string } | undefined)?.code;
    if (code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "An account with that email address already exists.");
    }
    if (code === "auth/invalid-email") {
      throw new HttpsError("invalid-argument", "That email address isn't valid.");
    }
    if (code === "auth/invalid-password") {
      throw new HttpsError("invalid-argument", "Password must be at least 6 characters.");
    }
    throw err;
  }
}

function isCampusManagerRole(role: unknown): boolean {
  return role === "admin" || role === "super-admin";
}

interface CallerAdminAccess {
  scope?: "global" | "campuses";
  campusIds?: string[];
  collegeIds?: string[];
}

// True if `callerRole` (+ their own adminAccess, when role === "admin") may
// create/edit/delete a counsellor/head login belonging to the given
// campus/college. Super Admin and a global-scope admin can always manage any
// campus/college; a campus-restricted admin only within their own
// campusIds, narrowed further to collegeIds when that's also set. Previously
// this check didn't exist at all here — only the UI's campus picker limited
// what a scoped admin could reach, which isn't real enforcement.
function canManageCampusLogin(
  callerRole: unknown,
  callerAdminAccess: CallerAdminAccess | undefined,
  targetCampusId: string | undefined,
  targetCollegeId: string | undefined,
): boolean {
  if (callerRole === "super-admin") return true;
  if (callerRole !== "admin") return false;
  if (!callerAdminAccess || callerAdminAccess.scope === "global") return true;
  if (!targetCampusId || !callerAdminAccess.campusIds?.includes(targetCampusId)) return false;
  if (
    callerAdminAccess.collegeIds?.length &&
    (!targetCollegeId || !callerAdminAccess.collegeIds.includes(targetCollegeId))
  ) {
    return false;
  }
  return true;
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
  const callerData = callerDoc.data();
  if (!isCampusManagerRole(callerData?.role)) {
    throw new HttpsError("permission-denied", "Only an Admin or Super Admin can delete a campus login.");
  }

  const targetUid = request.data.uid;
  if (!targetUid || typeof targetUid !== "string") {
    throw new HttpsError("invalid-argument", "A target uid is required.");
  }

  // Deleting an Admin or Super Admin account is Super-Admin-only — previously
  // this had no check on the *target's* role at all, so any admin could
  // delete any other admin (or even a super-admin) they knew the uid of.
  const targetDoc = await db.collection("users").doc(targetUid).get();
  const targetData = targetDoc.data();
  const targetRole = targetData?.role;
  if ((targetRole === "admin" || targetRole === "super-admin") && callerData?.role !== "super-admin") {
    throw new HttpsError("permission-denied", "Only a Super Admin can delete an Admin or Super Admin login.");
  }
  if (
    (targetRole === "counsellor" || targetRole === "head") &&
    !canManageCampusLogin(callerData?.role, callerData?.adminAccess, targetData?.campusId, targetData?.collegeId)
  ) {
    throw new HttpsError("permission-denied", "You don't have access to delete this login.");
  }

  await auth.deleteUser(targetUid);
  await db.collection("users").doc(targetUid).delete();

  return { success: true };
});

// ── Admin logins (Super Admin only) ────────────────────────────────────────
// Unlike createCampusLogin (counsellor/head, any campus manager), an Admin
// login can itself manage campuses/colleges/other logins, so only a Super
// Admin may create or edit one — never another Admin.

const ADMIN_SECTION_IDS = [
  "campuses",
  "logins",
  "events",
  "analytics",
  "ssi-analytics",
  "serious-cases",
  "counsellor-worksheet",
  "monthly-reports",
];

const ADMIN_DESIGNATIONS = ["principal", "vice-principal", "administration", "management"];

interface AdminAccessInput {
  scope: "global" | "campuses";
  campusIds?: string[];
  collegeIds?: string[]; // optional further narrowing within campusIds — only meaningful when scope === "campuses"
  sections: string[];
  designation?: string; // capability preset that also affects role-specific access rules
}

async function validateAdminAccess(adminAccess: AdminAccessInput): Promise<void> {
  if (adminAccess.scope !== "global" && adminAccess.scope !== "campuses") {
    throw new HttpsError("invalid-argument", "Scope must be 'global' or 'campuses'.");
  }
  if (!Array.isArray(adminAccess.sections) || adminAccess.sections.some((s) => !ADMIN_SECTION_IDS.includes(s))) {
    throw new HttpsError("invalid-argument", "Invalid section list.");
  }
  if (adminAccess.designation !== undefined && !ADMIN_DESIGNATIONS.includes(adminAccess.designation)) {
    throw new HttpsError("invalid-argument", "Invalid designation.");
  }
  if (adminAccess.designation === "administration" && adminAccess.scope !== "campuses") {
    throw new HttpsError("invalid-argument", "Administration accounts must be restricted to assigned campuses and colleges.");
  }
  if (
    adminAccess.designation === "administration" &&
    (!Array.isArray(adminAccess.collegeIds) || adminAccess.collegeIds.length === 0)
  ) {
    throw new HttpsError("invalid-argument", "Assign at least one college to an Administration account.");
  }
  if (adminAccess.scope === "campuses") {
    if (adminAccess.sections.includes("campuses")) {
      throw new HttpsError("invalid-argument", "A campus-restricted admin cannot be granted Campus Management.");
    }
    if (!Array.isArray(adminAccess.campusIds) || adminAccess.campusIds.length === 0) {
      throw new HttpsError("invalid-argument", "At least one campus is required for a restricted admin.");
    }
    const campusDocs = await Promise.all(
      adminAccess.campusIds.map((id) => db.collection("campuses").doc(id).get()),
    );
    if (campusDocs.some((d) => !d.exists)) {
      throw new HttpsError("invalid-argument", "One or more campuses do not exist.");
    }
    // Every non-global admin (Principal, Vice-Principal, …) must be tied to
    // specific colleges — that is what scopes their academic-year data.
    if (!Array.isArray(adminAccess.collegeIds) || adminAccess.collegeIds.length === 0) {
      throw new HttpsError("invalid-argument", "Assign at least one college to a campus-restricted admin.");
    }
    {
      const collegeDocs = await Promise.all(
        adminAccess.collegeIds.map((id) => db.collection("colleges").doc(id).get()),
      );
      if (collegeDocs.some((d) => !d.exists)) {
        throw new HttpsError("invalid-argument", "One or more colleges do not exist.");
      }
      const outOfScope = collegeDocs.some((d) => !adminAccess.campusIds!.includes(d.data()?.campusId));
      if (outOfScope) {
        throw new HttpsError("invalid-argument", "Every assigned college must belong to one of the assigned campuses.");
      }
    }
  } else if (adminAccess.collegeIds && adminAccess.collegeIds.length > 0) {
    throw new HttpsError("invalid-argument", "Colleges can only be assigned to a campus-restricted admin.");
  }
}

interface CreateAdminLoginRequest {
  email: string;
  password: string;
  displayName: string;
  adminAccess: AdminAccessInput;
}

export const createAdminLogin = onCall<CreateAdminLoginRequest>(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const callerDoc = await db.collection("users").doc(callerUid).get();
  if (callerDoc.data()?.role !== "super-admin") {
    throw new HttpsError("permission-denied", "Only a Super Admin can create an Admin login.");
  }

  const { email, password, displayName, adminAccess } = request.data;
  const normalizedEmail = email.toLowerCase();
  if (!normalizedEmail || !password || !displayName || !adminAccess) {
    throw new HttpsError("invalid-argument", "Email, password, display name, and access settings are required.");
  }
  await validateAdminAccess(adminAccess);

  const userRecord = await createAuthUser({ email: normalizedEmail, password, displayName });
  try {
    await db.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: normalizedEmail,
      displayName,
      role: "admin",
      adminAccess,
      createdAt: Date.now(),
    });
  } catch (err) {
    await auth.deleteUser(userRecord.uid);
    throw err;
  }

  return { success: true, uid: userRecord.uid };
});

interface UpdateAdminLoginRequest {
  uid: string;
  displayName: string;
  email: string;
  password?: string;
  adminAccess: AdminAccessInput;
}

export const updateAdminLogin = onCall<UpdateAdminLoginRequest>(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const callerDoc = await db.collection("users").doc(callerUid).get();
  if (callerDoc.data()?.role !== "super-admin") {
    throw new HttpsError("permission-denied", "Only a Super Admin can edit an Admin login.");
  }

  const { uid, displayName, email, password, adminAccess } = request.data;
  if (!uid || typeof uid !== "string") {
    throw new HttpsError("invalid-argument", "A target uid is required.");
  }
  if (!adminAccess) {
    throw new HttpsError("invalid-argument", "Access settings are required.");
  }
  const normalizedEmail = email.toLowerCase();
  await validateAdminAccess(adminAccess);

  const targetDoc = await db.collection("users").doc(uid).get();
  if (targetDoc.data()?.role !== "admin") {
    throw new HttpsError("invalid-argument", "That login is not an Admin account.");
  }

  await auth.updateUser(uid, {
    email: normalizedEmail,
    displayName,
    ...(password ? { password } : {}),
  });

  await db.collection("users").doc(uid).update({ displayName, email: normalizedEmail, adminAccess });

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
  const callerData = callerDoc.data();
  if (!isCampusManagerRole(callerData?.role)) {
    throw new HttpsError("permission-denied", "Only an Admin or Super Admin can create a campus login.");
  }

  const { email, password, displayName, role, campusId, collegeId } = request.data;
  const normalizedEmail = email.toLowerCase();
  if (!normalizedEmail || !password || !displayName || !campusId || !collegeId) {
    throw new HttpsError("invalid-argument", "Email, password, display name, campus, and college are required.");
  }
  if (role !== "counsellor" && role !== "head") {
    throw new HttpsError("invalid-argument", "Role must be counsellor or head.");
  }

  const collegeDoc = await db.collection("colleges").doc(collegeId).get();
  if (!collegeDoc.exists || collegeDoc.data()?.campusId !== campusId) {
    throw new HttpsError("invalid-argument", "That college does not belong to the selected campus.");
  }
  if (!canManageCampusLogin(callerData?.role, callerData?.adminAccess, campusId, collegeId)) {
    throw new HttpsError("permission-denied", "You don't have access to create a login for that campus/college.");
  }

  if (role === "head") {
    // Multiple Heads are now allowed per campus; no one-head restriction.
  }

  const userRecord = await createAuthUser({ email: normalizedEmail, password, displayName });
  try {
    await db.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: normalizedEmail,
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
  password?: string; // omitted on a bulk import row — defaults to the shared STUDENT_DEFAULT_PASSWORD
  studentOrProfessional: "student" | "professional";
  registerNumber?: string; // client always derives this from the email; re-derived here too as a fallback
  yearOrBatch?: string;
  admissionType?: "regular" | "lateral";
  branch?: string;
  gender?: string;
}

const STUDENT_DEFAULT_PASSWORD = "123456";

// A Head can only ever create students on their own campus; a Super Admin can
// create one on any campus, resolved from the college they picked (colleges
// carry their own campusId, so there's nothing else to trust the caller on).
export const createStudentLogin = onCall<CreateStudentLoginRequest>(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const callerDoc = await db.collection("users").doc(callerUid).get();
  const callerData = callerDoc.data();
  const callerRole = callerData?.role;
  if (callerRole !== "head" && callerRole !== "super-admin") {
    throw new HttpsError("permission-denied", "Only a Head or Super Admin can create a student login.");
  }
  if (callerRole === "head" && !callerData?.campusId) {
    throw new HttpsError("permission-denied", "Only a Head with a campus can create student logins.");
  }

  const { email, collegeId, password, studentOrProfessional, registerNumber, yearOrBatch, admissionType, branch, gender } =
    request.data;
  const normalizedEmail = email.toLowerCase();
  if (!normalizedEmail || !collegeId) {
    throw new HttpsError("invalid-argument", "Email and college are required.");
  }
  if (studentOrProfessional !== "student" && studentOrProfessional !== "professional") {
    throw new HttpsError("invalid-argument", "Student / Professional must be set.");
  }
  if (admissionType !== undefined && admissionType !== "regular" && admissionType !== "lateral") {
    throw new HttpsError("invalid-argument", "Regular / Lateral must be either \"regular\" or \"lateral\".");
  }
  const resolvedRegisterNumber = registerNumber || normalizedEmail.split("@")[0]?.toUpperCase() || "";

  const collegeDoc = await db.collection("colleges").doc(collegeId).get();
  if (!collegeDoc.exists) {
    throw new HttpsError("invalid-argument", "That college does not exist.");
  }
  const collegeCampusId = collegeDoc.data()?.campusId as string | undefined;
  if (callerRole === "head" && collegeCampusId !== callerData?.campusId) {
    throw new HttpsError("invalid-argument", "That college does not belong to your campus.");
  }
  if (!collegeCampusId) {
    throw new HttpsError("invalid-argument", "That college has no campus set.");
  }
  const campusId = collegeCampusId;

  const userRecord = await createAuthUser({ email: normalizedEmail, password: password || STUDENT_DEFAULT_PASSWORD });
  try {
    await db.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: normalizedEmail,
      role: "user",
      campusId,
      collegeId,
      studentOrProfessional,
      ...(resolvedRegisterNumber ? { registerNumber: resolvedRegisterNumber } : {}),
      ...(yearOrBatch ? { yearOrBatch } : {}),
      ...(admissionType ? { admissionType } : {}),
      ...(branch ? { branch } : {}),
      ...(gender ? { gender } : {}),
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
  active?: boolean; // defaults true; false disables the Firebase Auth account (can't sign in)
}

export const exportStaffData = onCall<{ uid: string }>(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Sign in required.");
  const callerDoc = await db.collection("users").doc(callerUid).get();
  const callerData = callerDoc.data();
  if (!isCampusManagerRole(callerData?.role)) {
    throw new HttpsError("permission-denied", "Only Admins can export staff data.");
  }
  const uid = request.data?.uid;
  if (!uid) throw new HttpsError("invalid-argument", "uid required.");
  const targetDoc = await db.collection("users").doc(uid).get();
  const targetData = targetDoc.data();
  if (!targetData || (targetData.role !== "counsellor" && targetData.role !== "head")) {
    throw new HttpsError("invalid-argument", "Target is not staff.");
  }
  if (targetData.active !== false) {
    throw new HttpsError("failed-precondition", "Only inactive staff can be exported.");
  }
  const bookingsSnap = await db.collection("bookings").where("counsellorId", "==", uid).get();
  const feedbackSnap = await db.collection("sessionFeedback").where("counsellorId", "==", uid).get();
  const cmrSnap = await db.collection("counsellorMonthlyReports").where("uploadedByUid", "==", uid).get();
  const mrSnap = await db.collection("monthlyReports").where("uploadedByUid", "==", uid).get();
  const seriousSnap = await db.collection("seriousCases").where("counsellorId", "==", uid).get();
  return {
    user: targetData,
    bookings: bookingsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    feedback: feedbackSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    counsellorMonthlyReports: cmrSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    monthlyReports: mrSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    seriousCases: seriousSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
});

export const updateCampusLogin = onCall<UpdateCampusLoginRequest>(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const callerDoc = await db.collection("users").doc(callerUid).get();
  const callerData = callerDoc.data();
  if (!isCampusManagerRole(callerData?.role)) {
    throw new HttpsError("permission-denied", "Only an Admin or Super Admin can edit a campus login.");
  }

  const { uid, displayName, email, password, role, collegeId, active } = request.data;
  if (!uid || typeof uid !== "string") {
    throw new HttpsError("invalid-argument", "A target uid is required.");
  }
  const normalizedEmail = email.toLowerCase();
  const isActive = active !== false;

  const targetDoc = await db.collection("users").doc(uid).get();
  const targetData = targetDoc.data();
  const campusId = targetData?.campusId;

  // Must be allowed to manage this login both where it currently is AND
  // where it's being moved to (collegeId can change on edit; campus cannot).
  if (
    !canManageCampusLogin(callerData?.role, callerData?.adminAccess, campusId, targetData?.collegeId) ||
    !canManageCampusLogin(callerData?.role, callerData?.adminAccess, campusId, collegeId)
  ) {
    throw new HttpsError("permission-denied", "You don't have access to manage this login.");
  }

  if (role === "head" && campusId) {
    // Multiple Heads are now allowed per campus; no one-head restriction.
  }

  await auth.updateUser(uid, {
    email: normalizedEmail,
    displayName,
    disabled: !isActive,
    ...(password ? { password } : {}),
  });

  await db.collection("users").doc(uid).update({ displayName, email: normalizedEmail, role, collegeId, active: isActive });

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

// ── Consolidated report signing ─────────────────────────────────────────────
// Verifying a Head's consolidated report runs server-side (not a plain client
// updateDoc) because stamping the Admin's signature onto a copy of the report
// requires reading the original file's bytes from Storage — this bucket has
// no CORS configured (see src/utils/attachmentMetadata.ts), so a client-side
// fetch() of it silently fails. The Admin SDK talks to Storage directly, no
// CORS involved.

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

function detectImageKind(bytes: Buffer): "png" | "jpg" | null {
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  return null;
}

/** One verification page: report metadata + the Admin's signature image.
    Used standalone as the "certificate" for a non-PDF original, or copied in
    as an appended last page when the original is itself a PDF. */
async function buildVerificationPage(opts: {
  reportTitle: string;
  periodLabel: string;
  submittedBy: string;
  verifiedBy: string;
  verifiedAtLabel: string;
  signatureBytes: Buffer | null;
  signatureKind: "png" | "jpg" | null;
}): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const marginX = 70;
  let y = A4_HEIGHT - 120;

  page.drawText("Verification Certificate", { x: marginX, y, size: 22, font: bold, color: rgb(0.06, 0.09, 0.23) });
  y -= 36;
  page.drawLine({ start: { x: marginX, y }, end: { x: A4_WIDTH - marginX, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
  y -= 40;

  function field(label: string, value: string) {
    page.drawText(label, { x: marginX, y, size: 11, font: bold, color: rgb(0.4, 0.4, 0.4) });
    y -= 18;
    page.drawText(value, { x: marginX, y, size: 14, font: regular, color: rgb(0.1, 0.1, 0.1) });
    y -= 36;
  }

  field("REPORT", opts.reportTitle);
  field("PERIOD", opts.periodLabel);
  field("SUBMITTED BY", opts.submittedBy);
  field("VERIFIED BY", `${opts.verifiedBy} on ${opts.verifiedAtLabel}`);

  y -= 10;
  page.drawText("Authorized signature", { x: marginX, y, size: 11, font: bold, color: rgb(0.4, 0.4, 0.4) });
  y -= 14;

  if (opts.signatureBytes && opts.signatureKind) {
    const img =
      opts.signatureKind === "png"
        ? await pdfDoc.embedPng(opts.signatureBytes)
        : await pdfDoc.embedJpg(opts.signatureBytes);
    const maxWidth = 180;
    const scale = Math.min(1, maxWidth / img.width);
    const w = img.width * scale;
    const h = img.height * scale;
    y -= h;
    page.drawImage(img, { x: marginX, y, width: w, height: h });
  } else {
    y -= 16;
    page.drawText("(signature image unavailable — unsupported file format)", {
      x: marginX,
      y,
      size: 10,
      font: regular,
      color: rgb(0.6, 0.2, 0.2),
    });
  }

  return pdfDoc;
}

interface VerifyMonthlyReportRequest {
  reportId: string;
}

export const verifyMonthlyReport = onCall<VerifyMonthlyReportRequest>(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const callerDoc = await db.collection("users").doc(callerUid).get();
  const callerData = callerDoc.data();
  const isPrincipalOrVpCaller =
    callerData?.role === "admin" && hasDesignation(callerData ?? {}, ["principal", "vice-principal"]);
  const isAdministrationCaller =
    callerData?.role === "admin" && hasDesignation(callerData ?? {}, ["administration"]);
  if (!isCampusManagerRole(callerData?.role) || isPrincipalOrVpCaller || isAdministrationCaller) {
    throw new HttpsError("permission-denied", "Only an Admin or Super Admin can verify a consolidated report.");
  }
  const verifiedByUid = callerUid;
  const verifiedBy = (callerData?.displayName as string | undefined) || (callerData?.email as string | undefined) || "Admin";

  const { reportId } = request.data;
  if (!reportId || typeof reportId !== "string") {
    throw new HttpsError("invalid-argument", "reportId is required.");
  }

  const reportRef = db.collection("monthlyReports").doc(reportId);
  const reportSnap = await reportRef.get();
  if (!reportSnap.exists) {
    throw new HttpsError("not-found", "Report not found.");
  }
  const report = reportSnap.data()!;
  const callerAccess = callerData?.adminAccess as
    | { scope?: string; campusIds?: string[] }
    | undefined;
  if (
    callerData?.role === "admin" &&
    callerAccess?.scope === "campuses" &&
    (!Array.isArray(callerAccess.campusIds) || !callerAccess.campusIds.includes(String(report.campusId ?? "")))
  ) {
    throw new HttpsError("permission-denied", "You don't have access to verify reports from this campus.");
  }
  if (report.status !== "pending") {
    throw new HttpsError("failed-precondition", "Only pending reports can be verified.");
  }

  // No signature uploaded — verify exactly as before, no signed artifact.
  const signatureSnap = await db.collection("users").doc(callerUid).collection("signature").doc("current").get();
  const signatureURL = signatureSnap.exists ? (signatureSnap.data()?.signatureURL as string | undefined) : undefined;
  if (!signatureURL) {
    await reportRef.update({
      status: "verified",
      verifiedBy,
      verifiedByUid,
      verifiedAt: FieldValue.serverTimestamp(),
    });

    return { success: true, signed: false };
  }

  const bucket = storage.bucket();
  const storagePath = report.storagePath as string;
  const fileName = (report.fileName as string) || "report";
  const isPdf = fileName.toLowerCase().endsWith(".pdf");

  const [originalBytes] = await bucket.file(storagePath).download();
  const sigResponse = await fetch(signatureURL);
  const sigBytes = Buffer.from(await sigResponse.arrayBuffer());
  const signatureKind = detectImageKind(sigBytes);

  const now = Date.now();
  const monthLabel = new Date(2000, ((report.month as number) || 1) - 1, 1).toLocaleString("en-US", { month: "long" });
  const periodLabel = `${monthLabel} ${report.year ?? ""}`;
  const verifiedAtLabel = new Date(now).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const verificationDoc = await buildVerificationPage({
    reportTitle: (report.title as string) || "Consolidated Report",
    periodLabel,
    submittedBy: (report.uploadedBy as string) || "Head",
    verifiedBy,
    verifiedAtLabel,
    signatureBytes: signatureKind ? sigBytes : null,
    signatureKind,
  });

  let outputDoc: PDFDocument;
  let signedKind: "stamped" | "certificate";
  if (isPdf) {
    outputDoc = await PDFDocument.load(originalBytes);
    const [copiedPage] = await outputDoc.copyPages(verificationDoc, [0]);
    outputDoc.addPage(copiedPage);
    signedKind = "stamped";
  } else {
    outputDoc = verificationDoc;
    signedKind = "certificate";
  }

  const outputBytes = await outputDoc.save();
  const baseName = fileName.replace(/\.[^.]+$/, "");
  const signedFileName = signedKind === "stamped" ? `Signed_${baseName}.pdf` : `Verification_Certificate_${baseName}.pdf`;
  const token = randomUUID();
  const signedStoragePath = `monthly-reports-signed/${reportId}/${now}.pdf`;
  await bucket.file(signedStoragePath).save(Buffer.from(outputBytes), {
    metadata: {
      contentType: "application/pdf",
      contentDisposition: `attachment; filename="${signedFileName.replace(/"/g, '\\"')}"`,
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });
  const signedDownloadURL = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(signedStoragePath)}?alt=media&token=${token}`;

  await reportRef.update({
    status: "verified",
    verifiedBy,
    verifiedByUid,
    verifiedAt: FieldValue.serverTimestamp(),
    signedDownloadURL,
    signedFileName,
    signedKind,
  });

  return { success: true, signed: true };
});

interface ReportNotificationInput {
  recipientId: string;
  reportId: string;
  reportKind: "consolidated" | "staff";
  title: string;
  message: string;
  eventTime: string;
}

async function writeReportNotification(input: ReportNotificationInput): Promise<void> {
  const notificationRef = db
    .collection("notifications")
    .doc(`${input.reportKind}-report-${input.reportId}-${input.recipientId}`);
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(notificationRef);
    const previousEventTime = existing.data()?.reportEventTime as string | undefined;
    if (previousEventTime && previousEventTime >= input.eventTime) return;
    transaction.set(notificationRef, {
      ...input,
      type: "monthly_report_uploaded",
      read: false,
      createdAt: Date.now(),
      reportEventTime: input.eventTime,
    });
  });
}

async function removeStaleReportNotifications(
  reportId: string,
  reportKind: ReportNotificationInput["reportKind"],
  recipientIds: Set<string>,
): Promise<void> {
  const notifications = await db.collection("notifications").where("reportId", "==", reportId).get();
  const batch = db.batch();
  let deleteCount = 0;
  for (const notification of notifications.docs) {
    const data = notification.data();
    if (data.type !== "monthly_report_uploaded" || (data.reportKind && data.reportKind !== reportKind)) continue;
    const recipientId = typeof data.recipientId === "string" ? data.recipientId : "";
    const canonicalId = `${reportKind}-report-${reportId}-${recipientId}`;
    if (!recipientIds.has(recipientId) || notification.id !== canonicalId) {
      batch.delete(notification.ref);
      deleteCount += 1;
    }
  }
  if (deleteCount > 0) await batch.commit();
}

function isConsolidatedReportRecipient(user: Record<string, unknown>, campusId: string): boolean {
  if (user.role !== "admin") return false;
  const access = user.adminAccess as
    | { designation?: string; scope?: string; campusIds?: string[] }
    | undefined;
  const hasDesignation =
    access?.designation === "management" ||
    access?.designation === "administration" ||
    (!access?.designation && (!access || access.scope === "global"));
  const hasCampusAccess =
    !access ||
    access.scope === "global" ||
    (access.scope === "campuses" &&
      Array.isArray(access.campusIds) &&
      access.campusIds.includes(campusId));
  return hasDesignation && hasCampusAccess;
}

async function sendConsolidatedReportNotifications(
  reportId: string,
  report: Record<string, unknown>,
  eventTime: string,
): Promise<number> {
  const campusId = typeof report.campusId === "string" ? report.campusId : "";
  const uploadedByUid = typeof report.uploadedByUid === "string" ? report.uploadedByUid : "";
  if (!campusId || !uploadedByUid) {
    console.warn("Skipping consolidated report notification: report data is incomplete.", { reportId });
    return 0;
  }

  const [adminsSnap, campusSnap, uploaderSnap] = await Promise.all([
    db.collection("users").where("role", "==", "admin").get(),
    db.collection("campuses").doc(campusId).get(),
    db.collection("users").doc(uploadedByUid).get(),
  ]);
  const uploader = uploaderSnap.data();
  if (uploader?.role !== "head" || uploader.campusId !== campusId) {
    console.warn("Skipping consolidated report notification: uploader is not the Head for this campus.", {
      reportId,
      campusId,
      uploadedByUid,
    });
    return 0;
  }

  const adminRecipients = adminsSnap.docs.filter((adminDoc) =>
    isConsolidatedReportRecipient(adminDoc.data(), campusId),
  );
  if (adminRecipients.length === 0) {
    console.error("No Management or Administration recipient can access the consolidated report campus.", {
      reportId,
      campusId,
    });
  }

  const month = typeof report.month === "number" ? report.month : 1;
  const year = typeof report.year === "number" ? report.year : new Date().getFullYear();
  const monthName = new Date(year, month - 1, 1).toLocaleString("en-IN", { month: "long" });
  const campusData = campusSnap.data();
  const campusName = typeof campusData?.name === "string" ? campusData.name : "Campus";
  const title = typeof report.title === "string" ? report.title : `Consolidated Report — ${monthName} ${year}`;
  const message = `${campusName} has a consolidated report: ${title} (${monthName} ${year}).`;
  const recipients = new Set([...adminRecipients.map((recipient) => recipient.id), uploadedByUid]);

  await removeStaleReportNotifications(reportId, "consolidated", recipients);
  await Promise.all(
    [...recipients].map((recipientId) =>
      writeReportNotification({
        recipientId,
        reportId,
        reportKind: "consolidated",
        title: "Consolidated report shared",
        message,
        eventTime,
      }),
    ),
  );
  console.log("Consolidated report notifications created.", {
    reportId,
    campusId,
    recipientCount: recipients.size,
  });
  return recipients.size;
}

export const notifyConsolidatedReportRecipients = onDocumentWritten(
  { document: "monthlyReports/{reportId}", retry: true },
  async (event) => {
    const report = event.data?.after.data();
    if (!report || report.status !== "pending") return;
    await sendConsolidatedReportNotifications(
      event.params.reportId,
      report,
      event.time,
    );
  },
);

export const notifyMonthlyStaffReportRecipients = onDocumentWritten(
  { document: "counsellorMonthlyReports/{reportId}", retry: true },
  async (event) => {
    const report = event.data?.after.data();
    const reportId = event.params.reportId;
    if (!report || report.status !== "pending") return;

    const uploadedByUid = typeof report.uploadedByUid === "string" ? report.uploadedByUid : "";
    const campusId = typeof report.campusId === "string" ? report.campusId : "";
    const collegeId = typeof report.collegeId === "string" ? report.collegeId : "";
    const uploadedByRole = report.uploadedByRole;
    const recipientUids = Array.isArray(report.recipientUids)
      ? report.recipientUids.filter((uid): uid is string => typeof uid === "string")
      : [];
    if (!uploadedByUid || !campusId || !collegeId || recipientUids.length === 0) {
      console.warn("Skipping monthly staff report notification: report data is incomplete.", { reportId });
      return;
    }

    const [uploaderSnap, ...recipientSnaps] = await Promise.all([
      db.collection("users").doc(uploadedByUid).get(),
      ...recipientUids.map((uid) => db.collection("users").doc(uid).get()),
    ]);
    const uploader = uploaderSnap.data();
    if (
      !uploader ||
      uploader.role !== uploadedByRole ||
      uploader.campusId !== campusId ||
      uploader.collegeId !== collegeId ||
      (uploadedByRole !== "head" && uploadedByRole !== "counsellor")
    ) {
      console.warn("Skipping monthly staff report notification: uploader profile does not match report.", { reportId });
      return;
    }

    const validRecipients = recipientSnaps.filter((recipientSnap) => {
      const recipient = recipientSnap.data();
      if (!recipient) return false;
      if (uploadedByRole === "head") {
        const access = recipient.adminAccess as
          | { designation?: string; scope?: string; campusIds?: string[]; collegeIds?: string[] }
          | undefined;
        return (
          recipient.role === "admin" &&
          (access?.designation === "principal" || access?.designation === "vice-principal") &&
          access.scope === "campuses" &&
          access.campusIds?.includes(campusId) === true &&
          access.collegeIds?.includes(collegeId) === true
        );
      }
      return (
        recipient.role === "head" &&
        recipient.campusId === campusId &&
        recipient.collegeId === collegeId
      );
    });

    const month = typeof report.month === "number" ? report.month : 1;
    const year = typeof report.year === "number" ? report.year : new Date().getFullYear();
    const monthName = new Date(year, month - 1, 1).toLocaleString("en-IN", { month: "long" });
    const title = typeof report.title === "string" ? report.title : `Monthly Report — ${monthName} ${year}`;
    const validRecipientIds = new Set(validRecipients.map((recipient) => recipient.id));
    await removeStaleReportNotifications(reportId, "staff", validRecipientIds);
    await Promise.all(
      validRecipients.map((recipient) =>
        writeReportNotification({
          recipientId: recipient.id,
          reportId,
          reportKind: "staff",
          title: "Monthly report shared",
          message: `${String(report.uploadedBy || "Staff")} shared a monthly report: ${title} (${monthName} ${year}).`,
          eventTime: event.time,
        }),
      ),
    );
  },
);

interface ReshareMonthlyReportRequest {
  reportId: string;
}

export const reshareMonthlyReport = onCall<ReshareMonthlyReportRequest>(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "You must be signed in.");
  const { reportId } = request.data ?? {};
  if (!reportId || typeof reportId !== "string") {
    throw new HttpsError("invalid-argument", "reportId is required.");
  }

  const [callerSnap, reportSnap] = await Promise.all([
    db.collection("users").doc(callerUid).get(),
    db.collection("monthlyReports").doc(reportId).get(),
  ]);
  const caller = callerSnap.data();
  const report = reportSnap.data();
  if (!reportSnap.exists || !report) throw new HttpsError("not-found", "Consolidated report not found.");
  if (!isCampusManagerRole(caller?.role)) {
    throw new HttpsError("permission-denied", "Only an Admin or Super Admin can share a consolidated report.");
  }

  const campusId = typeof report.campusId === "string" ? report.campusId : "";
  const access = caller?.adminAccess as
    | { designation?: string; scope?: string; campusIds?: string[] }
    | undefined;
  const hasShareDesignation =
    caller?.role === "super-admin" ||
    !access ||
    access.scope === "global" && !access.designation ||
    access.designation === "management";
  const hasCampusAccess =
    caller?.role === "super-admin" ||
    !access ||
    access.scope === "global" ||
    (access.scope === "campuses" && access.campusIds?.includes(campusId) === true);
  if (!hasShareDesignation || !hasCampusAccess) {
    throw new HttpsError("permission-denied", "You don't have access to share this campus report.");
  }

  const recipientCount = await sendConsolidatedReportNotifications(
    reportId,
    report,
    new Date().toISOString(),
  );
  if (recipientCount === 0) {
    throw new HttpsError("failed-precondition", "No eligible Head or Admin recipients were found.");
  }
  return { success: true, recipientCount };
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

  // The target must actually be bookable by this student. A Counsellor is
  // scoped to one college, so they're matched by collegeId; a Head oversees
  // their whole campus (their own collegeId is a mandatory-but-meaningless
  // field on their account — never used as a real scope anywhere else in
  // this app), so they're matched by campusId instead. campusId is derived
  // here, server-side, rather than trusted from the client's own data.campusId.
  const counsellorSnap = await db.collection("users").doc(data.counsellorId).get();
  const counsellorProfile = counsellorSnap.data();
  const inScope = counsellorProfile
    ? counsellorProfile.role === "head"
      ? counsellorProfile.campusId === caller.campusId
      : counsellorProfile.collegeId === caller.collegeId
    : false;
  if (
    !counsellorProfile ||
    !["counsellor", "head"].includes(counsellorProfile.role) ||
    !counsellorProfile.campusId ||
    !inScope ||
    counsellorProfile.active === false
  ) {
    throw new HttpsError("invalid-argument", "That counsellor isn't available to book.");
  }
  const campusId = counsellorProfile.campusId as string;

  // One active booking per student, same rule the UI already tried to show —
  // now actually guaranteed. A "scheduled" session whose time has already
  // passed doesn't block a new one (mirrors isSessionEndedPending()
  // client-side — it just hasn't been formally closed yet). The check and
  // the create run inside one transaction so two near-simultaneous requests
  // (a double-click, two tabs) can't both pass the check before either has
  // written — Firestore aborts and retries whichever one loses that race.
  const now = Date.now();
  const bookingRef = db.collection("bookings").doc();
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(
      db.collection("bookings").where("userId", "==", callerUid).where("status", "in", ACTIVE_BOOKING_STATUSES),
    );

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

    tx.set(bookingRef, {
      userId: callerUid,
      userEmail: callerEmail,
      counsellorId: data.counsellorId,
      counsellorEmail: data.counsellorEmail,
      status: "pending",
      durationMinutes: SESSION_DURATION_MINUTES,
      proposedSlots: data.proposedSlots,
      campusId,
      // Stamped from the student's own profile so every record can be
      // separated per college (academic-year views and exports).
      ...(typeof caller.collegeId === "string" && caller.collegeId ? { collegeId: caller.collegeId } : {}),
      ...(data.concernCategories?.length ? { concernCategories: data.concernCategories } : {}),
      createdAt: now,
      updatedAt: now,
    });
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
// Crisis SOS sessions are handled immediately and never reach "scheduled" —
// they stay at status "accepted" the whole time they're being handled, so
// the scan below checks that status/scheduledAt combo separately. This is
// how long one can sit accepted-but-not-closed-out before it's flagged,
// shorter than a normal session's own duration since a crisis left open for
// hours unclosed is itself worth surfacing. Keep in sync with the client-side
// copy of this constant in services/firebase/bookings.ts.
const EMERGENCY_REVIEW_GRACE_MS = 2 * 60 * 60 * 1000;

export const flagMissedSessions = onSchedule("every 15 minutes", async () => {
  const now = Date.now();
  const [scheduledSnap, emergencySnap] = await Promise.all([
    db.collection("bookings").where("status", "==", "scheduled").get(),
    db.collection("bookings").where("status", "==", "accepted").where("isEmergency", "==", true).get(),
  ]);

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

  async function queueReview(
    docRef: FirebaseFirestore.QueryDocumentSnapshot,
    counsellorMessage: string,
    headMessage: string,
  ): Promise<void> {
    const b = docRef.data();
    const counsellorId = b.counsellorId as string;
    bookingUpdates.push(docRef.ref);
    notifications.push({
      recipientId: counsellorId,
      type: "session_needs_review",
      bookingId: docRef.id,
      title: "Session needs review",
      message: counsellorMessage,
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
          message: headMessage,
          read: false,
          createdAt: now,
        });
      }
    }
  }

  for (const docRef of scheduledSnap.docs) {
    const b = docRef.data();
    const scheduledAt = b.scheduledAt as number | undefined;
    if (typeof scheduledAt !== "number" || b.missedNotified) continue;
    const durationMinutes = typeof b.durationMinutes === "number" ? b.durationMinutes : 90;
    if (now < scheduledAt + durationMinutes * 60000) continue;

    const userEmail = b.userEmail as string;
    await queueReview(
      docRef,
      `Your session with ${userEmail} was scheduled to end and hasn't been marked yet — let us know what happened.`,
      `${b.counsellorEmail ?? "A counsellor"}'s session with ${userEmail} was scheduled to end and hasn't been marked yet.`,
    );
  }

  for (const docRef of emergencySnap.docs) {
    const b = docRef.data();
    const scheduledAt = b.scheduledAt as number | undefined;
    if (typeof scheduledAt !== "number" || b.missedNotified) continue;
    if (now < scheduledAt + EMERGENCY_REVIEW_GRACE_MS) continue;

    const userEmail = b.userEmail as string;
    await queueReview(
      docRef,
      `Your Crisis SOS session with ${userEmail} is still open and hasn't been closed out — let us know what happened.`,
      `${b.counsellorEmail ?? "A counsellor"}'s Crisis SOS session with ${userEmail} is still open and hasn't been closed out.`,
    );
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

// Runs once a day and notifies every student, counsellor, and head on a
// campus that has an event scheduled for today. "Today" is computed in IST
// (UTC+5:30) since that's this app's own timezone convention everywhere else
// (see attendance.ts's istDateKey on the client). The `todayNotifSentOn`
// flag on the event doc guards against double-notifying if this ever runs
// more than once on the same calendar day. A same-day event created after
// this already ran (7 AM IST) won't be caught by tomorrow's run either,
// since by then "today" no longer covers that event's date — createEvent
// in src/services/firebase/events.ts covers that gap by notifying
// immediately at creation time when the event is already for today.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export const sendEventTodayReminders = onSchedule(
  { schedule: "0 7 * * *", timeZone: "Asia/Kolkata" },
  async () => {
    const now = Date.now();
    const istNow = new Date(now + IST_OFFSET_MS);
    const todayKey = `${istNow.getUTCFullYear()}-${String(istNow.getUTCMonth() + 1).padStart(2, "0")}-${String(istNow.getUTCDate()).padStart(2, "0")}`;
    const istMidnightUtcMs = Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()) - IST_OFFSET_MS;
    const startOfDay = istMidnightUtcMs;
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;

    const eventsSnap = await db
      .collection("events")
      .where("eventDate", ">=", startOfDay)
      .where("eventDate", "<=", endOfDay)
      .get();

    const eventUpdates: FirebaseFirestore.DocumentReference[] = [];
    const notifications: Record<string, unknown>[] = [];
    const recipientsByCampus = new Map<string, string[]>();

    async function recipientsOnCampus(campusId: string): Promise<string[]> {
      if (recipientsByCampus.has(campusId)) return recipientsByCampus.get(campusId) ?? [];
      const [studentsSnap, counsellorsSnap, headsSnap] = await Promise.all([
        db.collection("users").where("role", "==", "user").where("campusId", "==", campusId).get(),
        db.collection("users").where("role", "==", "counsellor").where("campusId", "==", campusId).get(),
        db.collection("users").where("role", "==", "head").where("campusId", "==", campusId).get(),
      ]);
      const uids = [...studentsSnap.docs, ...counsellorsSnap.docs, ...headsSnap.docs].map((d) => d.id);
      recipientsByCampus.set(campusId, uids);
      return uids;
    }

    for (const docRef of eventsSnap.docs) {
      const e = docRef.data();
      if (e.todayNotifSentOn === todayKey) continue;
      const campusId = e.campusId as string | undefined;
      if (!campusId) continue;

      const recipientUids = await recipientsOnCampus(campusId);
      if (recipientUids.length === 0) continue;

      eventUpdates.push(docRef.ref);
      for (const uid of recipientUids) {
        notifications.push({
          recipientId: uid,
          type: "event_today",
          title: "Event today",
          message: `${e.title as string} is happening today on your campus.`,
          read: false,
          createdAt: now,
        });
      }
    }

    if (eventUpdates.length === 0 && notifications.length === 0) return;

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
    for (const ref of eventUpdates) queue(() => batch.update(ref, { todayNotifSentOn: todayKey }));
    for (const n of notifications) queue(() => batch.set(db.collection("notifications").doc(), n));
    if (opsInBatch > 0) batches.push(batch);

    for (const b of batches) await b.commit();
  },
);

// ── Serious/SOS case escalation to Admin ────────────────────────────────────
// A Counsellor/Head closing out a Crisis SOS case (or a normal session they
// judge serious) can escalate it to the right Admin(s) for that student's
// college. Resolving "the right admin(s)" means scanning/filtering the whole
// admin population by designation + scope + collegeIds with a fallback
// chain — structurally impossible to validate from firestore.rules (rules
// can only get() one known doc, never list/filter a collection), so this
// whole flow goes through Admin-SDK callables rather than client writes.

const SERIOUS_CASE_ADMIN_DESIGNATIONS = {
  principalVp: ["principal", "vice-principal"],
  managementAdmin: ["management", "administration"],
};

function hasDesignation(admin: Record<string, unknown>, designations: string[]): boolean {
  const access = admin.adminAccess as { designation?: string } | undefined;
  return designations.includes(access?.designation ?? "");
}

type SeriousCaseAdmin = Record<string, unknown> & { uid: string };

function seriousCasePrincipalVpTargets(
  admins: SeriousCaseAdmin[],
  campusId: string,
  collegeId: string | null,
): SeriousCaseAdmin[] {
  if (!collegeId) return [];
  return admins.filter((admin) => {
    const access = admin.adminAccess as { scope?: string; campusIds?: string[]; collegeIds?: string[] } | undefined;
    return (
      access?.scope === "campuses" &&
      access.campusIds?.includes(campusId) === true &&
      access.collegeIds?.includes(collegeId) === true &&
      hasDesignation(admin, SERIOUS_CASE_ADMIN_DESIGNATIONS.principalVp)
    );
  });
}

interface CreateSeriousCaseRequest {
  bookingId: string;
  note: string;
}

export const createSeriousCase = onCall<CreateSeriousCaseRequest>(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const { bookingId, note } = request.data;
  if (!bookingId || typeof bookingId !== "string" || typeof note !== "string" || !note.trim() || note.length > 5000) {
    throw new HttpsError("invalid-argument", "A booking id and a non-empty note (max 5000 characters) are required.");
  }

  const [callerDoc, bookingDoc] = await Promise.all([
    db.collection("users").doc(callerUid).get(),
    db.collection("bookings").doc(bookingId).get(),
  ]);
  const caller = callerDoc.data();
  const booking = bookingDoc.data();
  if (!booking) {
    throw new HttpsError("not-found", "That booking was not found.");
  }

  const callerRole = caller?.role as string | undefined;
  if (callerRole !== "counsellor" && callerRole !== "head") {
    throw new HttpsError("permission-denied", "Only a Counsellor or Head can notify admin about a case.");
  }
  const isOwningCounsellor = callerRole === "counsellor" && booking.counsellorId === callerUid;
  const isCampusHead = callerRole === "head" && booking.campusId === caller?.campusId;
  if (!isOwningCounsellor && !isCampusHead) {
    throw new HttpsError("permission-denied", "You don't have access to this booking.");
  }
  if (!["accepted", "scheduled", "completed"].includes(booking.status as string)) {
    throw new HttpsError("failed-precondition", "This booking isn't in a state that can be flagged yet.");
  }

  const caseRef = db.collection("seriousCases").doc(bookingId);
  if ((await caseRef.get()).exists) {
    throw new HttpsError("already-exists", "A case has already been filed for this booking.");
  }

  const campusId = booking.campusId as string;
  // The college a case routes to is the HANDLING Counsellor/Head's own
  // collegeId, not the student's — collegeId is a required field on every
  // Counsellor/Head account (see createCampusLogin) so it's always present,
  // whereas a student's own profile can easily have none (never collected,
  // an offline-imported "client," etc.), which previously meant the case
  // silently skipped the Principal/VP tier and fell through to a much
  // broader platform-wide fallback for no real reason.
  const collegeId = (caller?.collegeId as string | undefined) ?? null;

  const adminsSnap = await db.collection("users").where("role", "==", "admin").get();
  const admins = adminsSnap.docs.map((d) => ({ uid: d.id, ...d.data() }) as Record<string, unknown> & { uid: string });
  console.log("createSeriousCase: resolving targets", {
    bookingId,
    campusId,
    collegeId,
    adminCount: admins.length,
    admins: admins.map((a) => ({
      uid: a.uid,
      email: a.email,
      adminAccess: a.adminAccess,
    })),
  });

  function coversCollege(admin: Record<string, unknown>): boolean {
    const access = admin.adminAccess as { scope?: string; campusIds?: string[]; collegeIds?: string[] } | undefined;
    if (!access || access.scope === "global") return true;
    const collegeIds = access.collegeIds ?? [];
    if (collegeIds.length > 0) return collegeId !== null && collegeIds.includes(collegeId);
    return (access.campusIds ?? []).includes(campusId);
  }
  function isGlobalScope(admin: Record<string, unknown>): boolean {
    const access = admin.adminAccess as { scope?: string } | undefined;
    return !access || access.scope === "global";
  }

  const principalVpTargets = seriousCasePrincipalVpTargets(admins, campusId, collegeId);

  let targetTier: "principal-vp" | "management-fallback" | "global-fallback" = "principal-vp";
  let targets = principalVpTargets;
  if (principalVpTargets.length === 0) {
    targetTier = "management-fallback";
    targets = admins.filter((a) => coversCollege(a) && hasDesignation(a, SERIOUS_CASE_ADMIN_DESIGNATIONS.managementAdmin));
  }
  if (targets.length === 0) {
    // Nobody for this specific college/campus — widen to any
    // Management/Administration admin platform-wide before giving up.
    targets = admins.filter((a) => hasDesignation(a, SERIOUS_CASE_ADMIN_DESIGNATIONS.managementAdmin));
  }
  if (targets.length === 0) {
    targetTier = "global-fallback";
    targets = admins.filter((a) => isGlobalScope(a));
  }
  if (targets.length === 0) {
    console.log("createSeriousCase: no admin matched any tier", { bookingId, campusId, collegeId });
    throw new HttpsError("failed-precondition", "No admin account is configured to receive this case.");
  }
  const reviewTargets = targetTier === "principal-vp" ? targets : [];
  // Management/Administration admins always have standing oversight visibility
  // into every case platform-wide. They receive FYIs, but only an assigned
  // college Principal/VP is a reviewer and part of the 24h action SLA.
  const oversightAdmins = admins.filter(
    (a) =>
      hasDesignation(a, SERIOUS_CASE_ADMIN_DESIGNATIONS.managementAdmin) &&
      !reviewTargets.some((t) => t.uid === a.uid),
  );
  const oversightRecipients = targetTier === "principal-vp"
    ? oversightAdmins
    : [...targets, ...oversightAdmins.filter((admin) => !targets.some((target) => target.uid === admin.uid))];
  console.log("createSeriousCase: resolved targets", {
    bookingId,
    targetTier,
    targetAdminUids: reviewTargets.map((a) => a.uid),
    targetAdminEmails: reviewTargets.map((a) => a.email),
    oversightAdminUids: oversightRecipients.map((a) => a.uid),
    oversightAdminEmails: oversightRecipients.map((a) => a.email),
  });

  let notifiedHeadUid: string | undefined;
  if (callerRole === "counsellor" && campusId) {
    const headSnap = await db
      .collection("users")
      .where("role", "==", "head")
      .where("campusId", "==", campusId)
      .limit(1)
      .get();
    notifiedHeadUid = headSnap.docs[0]?.id;
  }

  const now = Date.now();
  const caseData = {
    bookingId,
    studentId: booking.userId,
    studentEmail: booking.userEmail,
    campusId,
    collegeId,
    isEmergency: booking.isEmergency === true,
    originRole: callerRole,
    authorUid: callerUid,
    authorEmail: caller?.email ?? "",
    note: note.trim(),
    ...(notifiedHeadUid ? { notifiedHeadUid } : {}),
    targetAdminUids: reviewTargets.map((a) => a.uid),
    targetTier,
    status: "open",
    escalations: [],
    escalationCount: 0,
    lastEscalatedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const batch = db.batch();
  batch.set(caseRef, caseData);
  const caseTitle = booking.isEmergency ? "Crisis SOS case needs your review" : "Serious case flagged — needs your review";
  const caseMessage = `${caller?.email ?? "A staff member"} flagged a ${
    booking.isEmergency ? "Crisis SOS" : "session"
  } case with ${booking.userEmail ?? "a student"} for review.`;
  for (const admin of reviewTargets) {
    batch.set(db.collection("notifications").doc(), {
      recipientId: admin.uid,
      type: "serious_case_created",
      bookingId,
      title: caseTitle,
      message: caseMessage,
      read: false,
      createdAt: now,
    });
  }
  const oversightTitle = booking.isEmergency ? "Crisis SOS case filed (view only)" : "Serious case filed (view only)";
  const assignedReviewerText = reviewTargets.length
    ? `It is assigned to ${reviewTargets.map((admin) => admin.email ?? admin.uid).join(", ")}.`
    : "No Principal or Vice-Principal is assigned to this college yet; management can view the case, but cannot resolve it.";
  for (const admin of oversightRecipients) {
    batch.set(db.collection("notifications").doc(), {
      recipientId: admin.uid,
      type: "serious_case_created",
      bookingId,
      title: oversightTitle,
      message: `${caseMessage} For your visibility only. ${assignedReviewerText}`,
      read: false,
      createdAt: now,
    });
  }
  if (notifiedHeadUid) {
    batch.set(db.collection("notifications").doc(), {
      recipientId: notifiedHeadUid,
      type: "serious_case_head_notice",
      bookingId,
      title: "Serious case notified to admin",
      message: `${caller?.email ?? "A counsellor"}'s case for ${booking.userEmail ?? "a student"} has also been sent to admin for review.`,
      read: false,
      createdAt: now,
    });
  }
  await batch.commit();
  console.log("createSeriousCase: committed", {
    bookingId,
    targetTier,
    notifiedHeadUid,
    oversightNotified: oversightAdmins.length,
  });

  return { success: true, caseId: bookingId };
});

// Runs every 15 minutes; re-notifies the targeted admin(s) on any open case
// that's gone 24h+ without an "action taken" response, and keeps doing so
// every 24h until one is finally recorded. Structurally mirrors
// flagMissedSessions above (elapsed-time check via a timestamp field,
// batched writes in chunks of 400).
const SERIOUS_CASE_ESCALATION_MS = 24 * 60 * 60 * 1000;

export const escalateSeriousCases = onSchedule("every 15 minutes", async () => {
  const now = Date.now();
  const openSnap = await db.collection("seriousCases").where("status", "==", "open").get();
  if (openSnap.empty) return;

  const adminsSnap = await db.collection("users").where("role", "==", "admin").get();
  const admins = adminsSnap.docs
    .map((d) => ({ uid: d.id, ...d.data() }) as Record<string, unknown> & { uid: string });
  const oversightAdminUids = admins
    .filter((a) => hasDesignation(a, SERIOUS_CASE_ADMIN_DESIGNATIONS.managementAdmin))
    .map((a) => a.uid);

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

  for (const docRef of openSnap.docs) {
    const c = docRef.data();
    const campusId = typeof c.campusId === "string" ? c.campusId : "";
    const collegeId = typeof c.collegeId === "string" ? c.collegeId : null;
    const reviewers = seriousCasePrincipalVpTargets(admins, campusId, collegeId);
    const reviewerUids = reviewers.map((admin) => admin.uid).sort();
    const currentTargetUids = ((c.targetAdminUids as string[] | undefined) ?? []).slice().sort();
    const assignedReviewerChanged =
      c.targetTier !== (reviewerUids.length ? "principal-vp" : "management-fallback") ||
      reviewerUids.length !== currentTargetUids.length ||
      reviewerUids.some((uid, index) => uid !== currentTargetUids[index]);
    const isEmergency = c.isEmergency === true;
    const lastEscalatedAt = typeof c.lastEscalatedAt === "number" ? c.lastEscalatedAt : c.createdAt;
    const isOverdue = Boolean(collegeId) && now - lastEscalatedAt >= SERIOUS_CASE_ESCALATION_MS;
    const caseUpdate: Record<string, unknown> = {};

    if (assignedReviewerChanged) {
      caseUpdate.targetAdminUids = reviewerUids;
      caseUpdate.targetTier = reviewerUids.length ? "principal-vp" : "management-fallback";
      for (const reviewer of reviewers) {
        queue(() =>
          batch.set(db.collection("notifications").doc(), {
            recipientId: reviewer.uid,
            type: "serious_case_created",
            bookingId: c.bookingId,
            title: isEmergency ? "Crisis SOS case needs your review" : "Serious case needs your review",
            message: "An open case for your assigned college is awaiting your review.",
            read: false,
            createdAt: now,
          }),
        );
      }
    }

    if (isOverdue) {
      caseUpdate.lastEscalatedAt = now;
      caseUpdate.escalationCount = FieldValue.increment(1);
      caseUpdate.escalations = FieldValue.arrayUnion({ type: "re-notified", at: now });
      for (const reviewer of reviewers) {
        if (assignedReviewerChanged) continue;
        queue(() =>
          batch.set(db.collection("notifications").doc(), {
            recipientId: reviewer.uid,
            type: "serious_case_escalated",
            bookingId: c.bookingId,
            title: "Overdue: case still needs action",
            message: `A ${isEmergency ? "Crisis SOS" : "serious"} case has had no action taken for over 24 hours — please respond.`,
            read: false,
            createdAt: now,
          }),
        );
      }
      for (const uid of oversightAdminUids) {
        if (reviewerUids.includes(uid)) continue;
        queue(() =>
          batch.set(db.collection("notifications").doc(), {
            recipientId: uid,
            type: "serious_case_escalated",
            bookingId: c.bookingId,
            title: "Overdue: case still needs action (view only)",
            message: `A ${isEmergency ? "Crisis SOS" : "serious"} case remains open after 24 hours. Management visibility only; review belongs to the college Principal / Vice-Principal.`,
            read: false,
            createdAt: now,
          }),
        );
      }
    }
    if (Object.keys(caseUpdate).length > 0) {
      caseUpdate.updatedAt = now;
      queue(() => batch.update(docRef.ref, caseUpdate));
    }
  }
  if (opsInBatch > 0) batches.push(batch);

  for (const b of batches) await b.commit();
});

// ── Student mood visibility for Counsellor/Head ─────────────────────────────
// moodLogs/{uid}/entries/{date} is otherwise fully private (firestore.rules:
// isSelf(uid) only) — a student's daily mood log is personal wellness data,
// not blanket-readable the way a profile doc is. This callable is the one
// deliberate exception: it lets the Counsellor actually assigned to a
// booking (or the campus Head) see that student's mood/streak history when
// they open that booking's details, with the relationship verified
// server-side against the real booking record rather than opened up as a
// standing Firestore rule.
export const getStudentMoodLogs = onCall<{ bookingId: string }>(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }
  const bookingId = request.data?.bookingId;
  if (!bookingId || typeof bookingId !== "string") {
    throw new HttpsError("invalid-argument", "bookingId is required.");
  }

  const [callerDoc, bookingDoc] = await Promise.all([
    db.collection("users").doc(callerUid).get(),
    db.collection("bookings").doc(bookingId).get(),
  ]);
  const caller = callerDoc.data();
  const booking = bookingDoc.data();
  if (!booking) {
    throw new HttpsError("not-found", "That booking was not found.");
  }

  const callerRole = caller?.role as string | undefined;
  const isOwningCounsellor = callerRole === "counsellor" && booking.counsellorId === callerUid;
  const isCampusHead = callerRole === "head" && booking.campusId === caller?.campusId;
  if (!isOwningCounsellor && !isCampusHead) {
    throw new HttpsError("permission-denied", "You don't have access to this booking.");
  }

  const studentUid = booking.userId as string;
  const entriesSnap = await db.collection("moodLogs").doc(studentUid).collection("entries").get();
  return { entries: entriesSnap.docs.map((d) => d.data()) };
});

export { sendAppointmentEmails } from "./appointmentEmails";
export { emailOnEmergencySos, submitStudentReferral } from "./email";

// ───────────────────────── Academic years ─────────────────────────
//
// A campus's academic year (label + date range + the colleges that follow
// it). Written ONLY here — firestore.rules deny client writes — because the
// "no two years overlap for the same college" rule needs a query across the
// campus's other years, which rules can't express.

interface SaveAcademicYearRequest {
  id?: string; // present = edit, absent = create
  campusId: string;
  label: string;
  startDate: number;
  endDate: number;
  collegeIds: string[];
  status?: "active" | "closed";
}

export const saveAcademicYear = onCall<SaveAcademicYearRequest>(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }
  const callerData = (await db.collection("users").doc(callerUid).get()).data();
  const d = request.data;

  if (
    !d ||
    typeof d.campusId !== "string" ||
    !d.campusId ||
    typeof d.label !== "string" ||
    !d.label.trim() ||
    typeof d.startDate !== "number" ||
    typeof d.endDate !== "number" ||
    !Array.isArray(d.collegeIds) ||
    d.collegeIds.length === 0 ||
    !d.collegeIds.every((c) => typeof c === "string")
  ) {
    throw new HttpsError("invalid-argument", "Label, dates and at least one college are required.");
  }
  if (d.endDate <= d.startDate) {
    throw new HttpsError("invalid-argument", "The end date must be after the start date.");
  }
  if (d.status !== undefined && d.status !== "active" && d.status !== "closed") {
    throw new HttpsError("invalid-argument", "Invalid status.");
  }

  // Academic years are managed by the campus Head (or Super Admin) only —
  // Admin accounts of any designation/scope never create, edit, export or
  // delete this data (they only read it, for the year-scoped filtering on
  // their own dashboards).
  const role = callerData?.role;
  const allowed = role === "super-admin" || (role === "head" && callerData?.campusId === d.campusId);
  if (!allowed) {
    throw new HttpsError("permission-denied", "You cannot manage academic years for this campus.");
  }

  const collegeIds = Array.from(new Set(d.collegeIds));
  const collegeDocs = await Promise.all(collegeIds.map((id) => db.collection("colleges").doc(id).get()));
  if (collegeDocs.some((c) => !c.exists || c.data()?.campusId !== d.campusId)) {
    throw new HttpsError("invalid-argument", "Every selected college must belong to this campus.");
  }

  const startDate = d.startDate;
  const endDate = d.endDate;
  const existing = await db.collection("academicYears").where("campusId", "==", d.campusId).get();
  for (const other of existing.docs) {
    if (other.id === d.id) continue;
    const o = other.data();
    const overlapsDates = startDate <= (o.endDate as number) && endDate >= (o.startDate as number);
    const sharedCollege = (o.collegeIds as string[]).some((c) => collegeIds.includes(c));
    if (overlapsDates && sharedCollege) {
      throw new HttpsError(
        "already-exists",
        `These dates overlap "${o.label}" for a college already assigned to it. Adjust the dates or the colleges.`,
      );
    }
  }

  const now = Date.now();
  const payload = {
    campusId: d.campusId,
    label: d.label.trim(),
    startDate,
    endDate,
    collegeIds,
    status: d.status ?? "active",
    updatedAt: now,
  };

  if (d.id) {
    const ref = db.collection("academicYears").doc(d.id);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.campusId !== d.campusId) {
      throw new HttpsError("invalid-argument", "That academic year was not found on this campus.");
    }
    await ref.update(payload);
    return { id: d.id };
  }
  const ref = await db.collection("academicYears").add({ ...payload, createdBy: callerUid, createdAt: now });
  return { id: ref.id };
});

// One-off: stamps collegeId (from the student's own profile) on bookings
// created before collegeId was recorded, so they can be attributed to a
// college in academic-year views. Safe to re-run: it only touches bookings
// that have no collegeId yet and whose student has one.
export const backfillBookingCollegeIds = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }
  const callerData = (await db.collection("users").doc(callerUid).get()).data();
  const access = callerData?.adminAccess as { scope?: string } | undefined;
  const allowed =
    callerData?.role === "super-admin" ||
    callerData?.role === "head" ||
    (callerData?.role === "admin" && (!access || access.scope === "global"));
  if (!allowed) {
    throw new HttpsError("permission-denied", "Only a Head, global Admin or Super Admin can run this.");
  }

  // A Head only backfills their own campus; the others do everything.
  const campusFilter = callerData?.role === "head" ? (callerData.campusId as string) : null;
  const bookings = campusFilter
    ? await db.collection("bookings").where("campusId", "==", campusFilter).get()
    : await db.collection("bookings").get();

  const userCollege = new Map<string, string | null>();
  async function collegeOf(uid: string): Promise<string | null> {
    if (userCollege.has(uid)) return userCollege.get(uid) ?? null;
    const c = ((await db.collection("users").doc(uid).get()).data()?.collegeId as string | undefined) ?? null;
    userCollege.set(uid, c);
    return c;
  }

  let updated = 0;
  let batch = db.batch();
  let ops = 0;
  for (const b of bookings.docs) {
    const data = b.data();
    if (data.collegeId || typeof data.userId !== "string") continue;
    const collegeId = await collegeOf(data.userId);
    if (!collegeId) continue;
    batch.update(b.ref, { collegeId });
    updated++;
    if (++ops === 400) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();
  return { updated };
});

// ───────────── Academic year export / delete (per college) ─────────────
//
// Everything is separated by college: a download or a delete only ever
// covers one college of one academic year. Records are attributed by the
// `collegeId` stamped on them (bookings — see backfillBookingCollegeIds),
// and bounded by the year's start/end dates.

type CallerRecord = Record<string, unknown> | undefined;

function csvCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) lines.push(headers.map((h) => csvCell(row[h])).join(","));
  // BOM so Excel opens UTF-8 correctly.
  return "﻿" + lines.join("\n");
}

function isoDate(ms: unknown): string {
  return typeof ms === "number" ? new Date(ms).toISOString() : "";
}

// Head of the year's campus and a global Admin / Super Admin may act on any
// college of it; a college-restricted Admin only on their own colleges (and
// `manage` actions — delete — are never open to a restricted Admin).
// Academic Years export/delete is a Head-only (and Super Admin) capability —
// Admin accounts of any designation never manage or download this data, so
// there's deliberately no "admin" branch here at all (not just a hidden UI
// tab — this is what actually gates the callables below).
function canActOnYearCollege(caller: CallerRecord, campusId: string): boolean {
  const role = caller?.role;
  if (role === "super-admin") return true;
  if (role === "head") return caller?.campusId === campusId;
  return false;
}

async function loadYearCollegeRecords(year: Record<string, unknown>, collegeId: string) {
  const start = year.startDate as number;
  const end = year.endDate as number;

  // Single-field queries filtered in memory — a (collegeId + date range)
  // query would need a composite index per collection.
  const [bookingSnap, ssiSnap, eventSnap] = await Promise.all([
    db.collection("bookings").where("collegeId", "==", collegeId).get(),
    db.collection("ssi_college_results").where("collegeId", "==", collegeId).get(),
    db.collection("events").where("collegeId", "==", collegeId).get(),
  ]);

  const bookings = bookingSnap.docs.filter((d) => {
    const t = d.data().createdAt as number;
    return t >= start && t <= end;
  });
  const ssi = ssiSnap.docs.filter((d) => {
    const t = d.data().submittedAt as number;
    return t >= start && t <= end;
  });
  const events = eventSnap.docs.filter((d) => {
    const t = d.data().eventDate as number;
    return t >= start && t <= end;
  });

  // sessionFeedback docs are keyed by their booking id.
  const feedbackRefs = bookings.map((b) => db.collection("sessionFeedback").doc(b.id));
  const feedbackDocs = feedbackRefs.length > 0 ? await db.getAll(...feedbackRefs) : [];
  const feedback = feedbackDocs.filter((d) => d.exists);

  return { bookings, ssi, events, feedback };
}

async function loadYearForCaller(request: { auth?: { uid: string }; data: { yearId?: string; collegeId?: string } }) {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "You must be signed in.");
  const { yearId, collegeId } = request.data ?? {};
  if (!yearId || typeof yearId !== "string" || !collegeId || typeof collegeId !== "string") {
    throw new HttpsError("invalid-argument", "An academic year and a college are required.");
  }
  const yearSnap = await db.collection("academicYears").doc(yearId).get();
  const year = yearSnap.data();
  if (!year) throw new HttpsError("not-found", "That academic year was not found.");
  if (!(year.collegeIds as string[]).includes(collegeId)) {
    throw new HttpsError("invalid-argument", "That college is not part of this academic year.");
  }
  const caller = (await db.collection("users").doc(callerUid).get()).data();
  if (!canActOnYearCollege(caller, year.campusId as string)) {
    throw new HttpsError("permission-denied", "You are not allowed to do this for that college.");
  }
  return { callerUid, yearId, collegeId, year, yearRef: yearSnap.ref };
}

// Returns one CSV per record type for ONE college of ONE academic year, and
// stamps `exports.<collegeId>` on the year — delete refuses to run until
// that stamp exists. Student-identifying intake details (bookings/*/private)
// are intentionally not included.
export const exportAcademicYearCollege = onCall<{ yearId: string; collegeId: string }>(async (request) => {
  const { callerUid, collegeId, year, yearRef } = await loadYearForCaller(request);
  const { bookings, ssi, events, feedback } = await loadYearCollegeRecords(year, collegeId);

  const sessionRows = bookings.map((b) => {
    const d = b.data();
    return {
      bookingId: b.id,
      requestedAt: isoDate(d.createdAt),
      scheduledAt: isoDate(d.scheduledAt),
      status: d.status,
      outcome: d.outcome,
      isEmergency: d.isEmergency === true ? "yes" : "no",
      sessionMode: d.sessionMode,
      studentEmail: d.userEmail,
      counsellorEmail: d.counsellorEmail,
      concernCategories: Array.isArray(d.concernCategories) ? d.concernCategories.join("; ") : "",
      studentRating: d.userRatingOfCounsellor,
    };
  });
  const feedbackRows = feedback.map((f) => {
    const d = f.data() ?? {};
    return {
      bookingId: f.id,
      submittedAt: isoDate(d.submittedAt),
      counsellorEmail: d.counsellorEmail,
      studentEmail: d.userEmail,
      rating: d.rating,
      answers: d.answers,
    };
  });
  const ssiRows = ssi.map((s) => {
    const d = s.data();
    return {
      resultId: s.id,
      submittedAt: isoDate(d.submittedAt),
      studentEmail: d.userEmail,
      severity: d.severity,
      likertScore: d.likertScore,
      likertMax: d.likertMax,
      depressionScore: d.depressionScore,
      anxietyScore: d.anxietyScore,
      stressScore: d.stressScore,
    };
  });
  const eventRows = events.map((e) => {
    const d = e.data();
    return {
      eventId: e.id,
      eventDate: isoDate(d.eventDate),
      title: d.title,
      category: d.category,
      description: d.description,
    };
  });

  const files = [
    {
      name: "sessions.csv",
      content: toCsv(
        [
          "bookingId", "requestedAt", "scheduledAt", "status", "outcome", "isEmergency",
          "sessionMode", "studentEmail", "counsellorEmail", "concernCategories", "studentRating",
        ],
        sessionRows,
      ),
    },
    {
      name: "feedback.csv",
      content: toCsv(["bookingId", "submittedAt", "counsellorEmail", "studentEmail", "rating", "answers"], feedbackRows),
    },
    {
      name: "ssi-results.csv",
      content: toCsv(
        [
          "resultId", "submittedAt", "studentEmail", "severity", "likertScore", "likertMax",
          "depressionScore", "anxietyScore", "stressScore",
        ],
        ssiRows,
      ),
    },
    {
      name: "events.csv",
      content: toCsv(["eventId", "eventDate", "title", "category", "description"], eventRows),
    },
  ];

  const counts = {
    sessions: sessionRows.length,
    feedback: feedbackRows.length,
    ssiResults: ssiRows.length,
    events: eventRows.length,
  };
  await yearRef.update({
    [`exports.${collegeId}`]: { at: Date.now(), byUid: callerUid, counts },
    updatedAt: Date.now(),
  });

  return { files, counts };
});

// Permanently deletes ONE college's records for ONE closed, already-exported
// academic year: its bookings (with intake/private subcollections), their
// feedback and chat/resources, SSI results, and events in the date range.
// Bookings that never got a collegeId (legacy data) can't be attributed to a
// college and are left untouched.
export const deleteAcademicYearCollegeData = onCall<{ yearId: string; collegeId: string; confirm: string }>(
  async (request) => {
    const { callerUid, collegeId, year, yearRef } = await loadYearForCaller(request);

    if (year.status !== "closed") {
      throw new HttpsError("failed-precondition", "Close the academic year before deleting its data.");
    }
    const exportInfo = (year.exports as Record<string, { at: number }> | undefined)?.[collegeId];
    if (!exportInfo) {
      throw new HttpsError("failed-precondition", "Download this college's export first — it is required before deleting.");
    }
    if ((year.archive as Record<string, unknown> | undefined)?.[collegeId]) {
      throw new HttpsError("failed-precondition", "This college's data for this year was already deleted.");
    }
    const expected = `DELETE ${year.label as string}`;
    if (request.data.confirm !== expected) {
      throw new HttpsError("invalid-argument", `Type "${expected}" to confirm.`);
    }

    const { bookings, ssi, events, feedback } = await loadYearCollegeRecords(year, collegeId);
    const bookingIds = bookings.map((b) => b.id);

    // Chat messages and session resources hang off bookings by bookingId.
    async function refsByBookingId(collectionName: string, field: string) {
      const refs: FirebaseFirestore.DocumentReference[] = [];
      for (let i = 0; i < bookingIds.length; i += 30) {
        const chunk = bookingIds.slice(i, i + 30);
        const snap = await db.collection(collectionName).where(field, "in", chunk).get();
        refs.push(...snap.docs.map((d) => d.ref));
      }
      return refs;
    }
    const [chatRefs, resourceRefs] =
      bookingIds.length > 0
        ? await Promise.all([
            refsByBookingId("chat_messages", "chatRoomId"),
            refsByBookingId("session_resources", "bookingId"),
          ])
        : [[], []];

    // Summary snapshot kept on the year so multi-year trends survive.
    const summary = {
      deletedAt: Date.now(),
      byUid: callerUid,
      sessions: bookings.length,
      completedSessions: bookings.filter((b) => b.data().status === "completed" && b.data().outcome !== "missed").length,
      missedSessions: bookings.filter((b) => b.data().outcome === "missed").length,
      feedbackCount: feedback.length,
      averageRating:
        feedback.length > 0
          ? feedback.reduce((sum, f) => sum + (Number(f.data()?.rating) || 0), 0) / feedback.length
          : null,
      ssiResults: ssi.length,
      ssiSevere: ssi.filter((s) => s.data().severity === "severe").length,
      ssiMedium: ssi.filter((s) => s.data().severity === "medium").length,
      ssiNormal: ssi.filter((s) => s.data().severity === "normal").length,
      events: events.length,
    };
    await yearRef.update({ [`archive.${collegeId}`]: summary, updatedAt: Date.now() });

    const flat: FirebaseFirestore.DocumentReference[] = [
      ...feedback.map((f) => f.ref),
      ...ssi.map((s) => s.ref),
      ...events.map((e) => e.ref),
      ...chatRefs,
      ...resourceRefs,
    ];
    let batch = db.batch();
    let ops = 0;
    for (const ref of flat) {
      batch.delete(ref);
      if (++ops === 400) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }
    if (ops > 0) await batch.commit();
    // Bookings last, recursively, so their private/ subcollections go too.
    for (const b of bookings) await db.recursiveDelete(b.ref);

    return { summary };
  },
);
