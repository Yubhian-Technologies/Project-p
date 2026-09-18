import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, runTransaction, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./config";
import type { CommunityComment, CommunityFeedCursor, CommunityPost } from "../../types/communityPost";

const postsCollection = collection(db, "communityPosts");

function authorDocRef(postId: string) {
  return doc(db, "communityPosts", postId, "private", "author");
}

function commentAuthorDocRef(postId: string, commentId: string) {
  return doc(db, "communityPosts", postId, "comments", commentId, "private", "author");
}

function likeDocRef(postId: string, uid: string) {
  return doc(db, "communityPosts", postId, "likes", uid);
}

function myPostMarkerRef(uid: string, postId: string) {
  return doc(db, "users", uid, "myCommunityPosts", postId);
}

function myCommentMarkerRef(uid: string, commentId: string) {
  return doc(db, "users", uid, "myCommunityComments", commentId);
}

// Cross-referenced client-side against the feed so the UI can show a "Delete"
// button on a user's own anonymous posts without the community data itself
// ever exposing who wrote what.
export async function listMyPostIds(uid: string): Promise<Set<string>> {
  const snapshot = await getDocs(collection(db, "users", uid, "myCommunityPosts"));
  return new Set(snapshot.docs.map((d) => d.id));
}

export async function listMyCommentIds(uid: string): Promise<Set<string>> {
  const snapshot = await getDocs(collection(db, "users", uid, "myCommunityComments"));
  return new Set(snapshot.docs.map((d) => d.id));
}

export async function createCommunityPost(uid: string, campusId: string, text: string): Promise<string> {
  const now = Date.now();
  const docRef = await addDoc(postsCollection, {
    text,
    likeCount: 0,
    commentCount: 0,
    createdAt: now,
    campusId,
  });
  await setDoc(authorDocRef(docRef.id), { authorId: uid });
  await setDoc(myPostMarkerRef(uid, docRef.id), { createdAt: now });
  return docRef.id;
}

export async function deleteCommunityPost(uid: string, postId: string): Promise<void> {
  await deleteDoc(doc(db, "communityPosts", postId));
  await deleteDoc(authorDocRef(postId));
  await deleteDoc(myPostMarkerRef(uid, postId));
}

export async function addComment(uid: string, postId: string, text: string): Promise<string> {
  const now = Date.now();
  const commentRef = doc(collection(db, "communityPosts", postId, "comments"));
  await setDoc(commentRef, { postId, text, createdAt: now });
  await setDoc(commentAuthorDocRef(postId, commentRef.id), { authorId: uid });
  await setDoc(myCommentMarkerRef(uid, commentRef.id), { postId, createdAt: now });
  await runTransaction(db, async (transaction) => {
    const postRef = doc(db, "communityPosts", postId);
    const postSnap = await transaction.get(postRef);
    if (!postSnap.exists()) return;
    transaction.update(postRef, { commentCount: postSnap.data().commentCount + 1 });
  });
  return commentRef.id;
}

export async function deleteComment(uid: string, postId: string, commentId: string): Promise<void> {
  await deleteDoc(doc(db, "communityPosts", postId, "comments", commentId));
  await deleteDoc(commentAuthorDocRef(postId, commentId));
  await deleteDoc(myCommentMarkerRef(uid, commentId));
  await runTransaction(db, async (transaction) => {
    const postRef = doc(db, "communityPosts", postId);
    const postSnap = await transaction.get(postRef);
    if (!postSnap.exists()) return;
    transaction.update(postRef, { commentCount: Math.max(0, postSnap.data().commentCount - 1) });
  });
}

export async function hasLiked(uid: string, postId: string): Promise<boolean> {
  const snapshot = await getDoc(likeDocRef(postId, uid));
  return snapshot.exists();
}

/**
 * Toggles the current user's like on a post inside a single transaction —
 * reads the like doc + post doc, then writes both, so concurrent toggles
 * (e.g. a rapid double click) can never desync likeCount from the actual
 * number of like docs. Same read-check-write idiom as
 * flagMissedSessionPending in bookings.ts.
 */
export async function toggleLike(uid: string, postId: string): Promise<boolean> {
  const postRef = doc(db, "communityPosts", postId);
  const likeRef = likeDocRef(postId, uid);
  return runTransaction(db, async (transaction) => {
    const postSnap = await transaction.get(postRef);
    const likeSnap = await transaction.get(likeRef);
    if (!postSnap.exists()) return false;
    if (likeSnap.exists()) {
      transaction.delete(likeRef);
      transaction.update(postRef, { likeCount: Math.max(0, postSnap.data().likeCount - 1) });
      return false;
    }
    transaction.set(likeRef, { createdAt: Date.now() });
    transaction.update(postRef, { likeCount: postSnap.data().likeCount + 1 });
    return true;
  });
}

// ── Server-side feed (Cloud Functions) ─────────────────────────────────────
// The feed and comment reads run through callable functions that query the
// caller's OWN campus only, paginate, and — exclusively for that campus's
// Head/Counsellor — attach the real author identity. Regular users get the
// same anonymous posts as before, with zero extra identity reads.

export interface CommunityFeedPage {
  posts: CommunityPost[];
  hasMore: boolean;
  nextCursor: CommunityFeedCursor | null;
}

export async function fetchCommunityFeed(
  cursor: CommunityFeedCursor | null,
  limit = 20,
): Promise<CommunityFeedPage> {
  const callable = httpsCallable<{ cursor: CommunityFeedCursor | null; limit: number }, CommunityFeedPage>(
    functions,
    "getCommunityFeed",
  );
  const result = await callable({ cursor, limit });
  return result.data;
}

export interface CommunityCommentFeedPage {
  comments: CommunityComment[];
  hasMore: boolean;
  nextCursor: CommunityFeedCursor | null;
}

export async function fetchCommentFeed(
  postId: string,
  cursor: CommunityFeedCursor | null,
  limit = 50,
): Promise<CommunityCommentFeedPage> {
  const callable = httpsCallable<
    { postId: string; cursor: CommunityFeedCursor | null; limit: number },
    CommunityCommentFeedPage
  >(functions, "getCommentFeed");
  const result = await callable({ postId, cursor, limit });
  return result.data;
}