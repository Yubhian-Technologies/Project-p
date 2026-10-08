import { onCall, HttpsError } from "firebase-functions/v2/https";
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

  // Deleting an Admin or Super Admin account is Super-Admin-only — previously
  // this had no check on the *target's* role at all, so any admin could
  // delete any other admin (or even a super-admin) they knew the uid of.
  const targetDoc = await db.collection("users").doc(targetUid).get();
  const targetRole = targetDoc.data()?.role;
  if ((targetRole === "admin" || targetRole === "super-admin") && callerDoc.data()?.role !== "super-admin") {
    throw new HttpsError("permission-denied", "Only a Super Admin can delete an Admin or Super Admin login.");
  }

  await auth.deleteUser(targetUid);
  await db.collection("users").doc(targetUid).delete();

  return { success: true };
});

// ── Admin logins (Super Admin only) ────────────────────────────────────────
// Unlike createCampusLogin (counsellor/head, any campus manager), an Admin
// login can itself manage campuses/colleges/other logins, so only a Super
// Admin may create or edit one — never another Admin.

const ADMIN_SECTION_IDS = ["campuses", "logins", "events", "analytics", "counsellor-worksheet", "monthly-reports"];

interface AdminAccessInput {
  scope: "global" | "campuses";
  campusIds?: string[];
  sections: string[];
}

async function validateAdminAccess(adminAccess: AdminAccessInput): Promise<void> {
  if (adminAccess.scope !== "global" && adminAccess.scope !== "campuses") {
    throw new HttpsError("invalid-argument", "Scope must be 'global' or 'campuses'.");
  }
  if (!Array.isArray(adminAccess.sections) || adminAccess.sections.some((s) => !ADMIN_SECTION_IDS.includes(s))) {
    throw new HttpsError("invalid-argument", "Invalid section list.");
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
  if (!email || !password || !displayName || !adminAccess) {
    throw new HttpsError("invalid-argument", "Email, password, display name, and access settings are required.");
  }
  await validateAdminAccess(adminAccess);

  const userRecord = await auth.createUser({ email, password, displayName });
  try {
    await db.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
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
  await validateAdminAccess(adminAccess);

  const targetDoc = await db.collection("users").doc(uid).get();
  if (targetDoc.data()?.role !== "admin") {
    throw new HttpsError("invalid-argument", "That login is not an Admin account.");
  }

  await auth.updateUser(uid, {
    email,
    displayName,
    ...(password ? { password } : {}),
  });

  await db.collection("users").doc(uid).update({ displayName, email, adminAccess });

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
  password?: string; // omitted on a bulk import row — defaults to the shared STUDENT_DEFAULT_PASSWORD
  studentOrProfessional: "student" | "professional";
  yearOrBatch?: string;
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

  const { email, collegeId, password, studentOrProfessional, yearOrBatch, branch, gender } = request.data;
  if (!email || !collegeId) {
    throw new HttpsError("invalid-argument", "Email and college are required.");
  }
  if (studentOrProfessional !== "student" && studentOrProfessional !== "professional") {
    throw new HttpsError("invalid-argument", "Student / Professional must be set.");
  }

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

  const userRecord = await auth.createUser({ email, password: password || STUDENT_DEFAULT_PASSWORD });
  try {
    await db.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      role: "user",
      campusId,
      collegeId,
      studentOrProfessional,
      ...(yearOrBatch ? { yearOrBatch } : {}),
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
  if (!isCampusManagerRole(callerData?.role)) {
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

  // The counsellor must actually be on the student's own campus — this was
  // previously only a UI-level filter (easy to bypass, and buggy: the UI
  // wasn't even filtering), so a student could book any counsellor on any
  // campus. campusId is also derived here, server-side, rather than trusted
  // from the client's own data.campusId.
  const counsellorSnap = await db.collection("users").doc(data.counsellorId).get();
  const counsellorProfile = counsellorSnap.data();
  if (
    !counsellorProfile ||
    !["counsellor", "head"].includes(counsellorProfile.role) ||
    !counsellorProfile.campusId ||
    counsellorProfile.campusId !== caller.campusId
  ) {
    throw new HttpsError("invalid-argument", "That counsellor isn't available on your campus.");
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

// Runs once a day and notifies every student on a campus that has an event
// scheduled for today. "Today" is computed in IST (UTC+5:30) since that's
// this app's own timezone convention everywhere else (see attendance.ts's
// istDateKey on the client). The `todayNotifSentOn` flag on the event doc
// guards against double-notifying if this ever runs more than once on the
// same calendar day.
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
    const studentsByCampus = new Map<string, string[]>();

    async function studentsOnCampus(campusId: string): Promise<string[]> {
      if (studentsByCampus.has(campusId)) return studentsByCampus.get(campusId) ?? [];
      const snap = await db
        .collection("users")
        .where("role", "==", "user")
        .where("campusId", "==", campusId)
        .get();
      const uids = snap.docs.map((d) => d.id);
      studentsByCampus.set(campusId, uids);
      return uids;
    }

    for (const docRef of eventsSnap.docs) {
      const e = docRef.data();
      if (e.todayNotifSentOn === todayKey) continue;
      const campusId = e.campusId as string | undefined;
      if (!campusId) continue;

      const studentUids = await studentsOnCampus(campusId);
      if (studentUids.length === 0) continue;

      eventUpdates.push(docRef.ref);
      for (const uid of studentUids) {
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

export { sendAppointmentEmails } from "./appointmentEmails";
