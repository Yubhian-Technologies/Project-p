import { onCall, HttpsError } from "firebase-functions/v2/https";
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
