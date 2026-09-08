import { addDoc, collection, deleteDoc, doc, getDocs, query, where } from "firebase/firestore";
import { db } from "./config";
import type { College } from "../../types/college";

const collegesCollection = collection(db, "colleges");

export async function listColleges(campusId: string): Promise<College[]> {
  const q = query(collegesCollection, where("campusId", "==", campusId));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }) as College)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function createCollege(campusId: string, name: string): Promise<string> {
  const docRef = await addDoc(collegesCollection, { campusId, name, createdAt: Date.now() });
  return docRef.id;
}

export async function deleteCollege(id: string): Promise<void> {
  await deleteDoc(doc(db, "colleges", id));
}
