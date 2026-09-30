import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./config";

const DOC_ID = "current";

/**
 * A user's digital signature image — kept in a private subcollection under
 * their own `users/{uid}` doc (mirrors the `myCommunityPosts`/
 * `myCommunityComments` pattern used elsewhere) so it stays visible only to
 * the owner, not to any other signed-in user the way the shared profile
 * fields are. Only Head/Counsellor/Admin accounts use this.
 */
export async function saveSignatureURL(uid: string, signatureURL: string): Promise<void> {
  await setDoc(doc(db, "users", uid, "signature", DOC_ID), {
    signatureURL,
    uploadedAt: serverTimestamp(),
  });
}

export async function getSignatureURL(uid: string): Promise<string | null> {
  const snap = await getDoc(doc(db, "users", uid, "signature", DOC_ID));
  if (!snap.exists()) return null;
  return (snap.data().signatureURL as string | undefined) ?? null;
}
