import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { db } from "./config";
import type { Campus } from "../../types/campus";

const campusesCollection = collection(db, "campuses");

export async function listCampuses(): Promise<Campus[]> {
  const snapshot = await getDocs(campusesCollection);
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Campus)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function createCampus(name: string): Promise<string> {
  const docRef = await addDoc(campusesCollection, { name, createdAt: Date.now() });
  return docRef.id;
}

export async function updateCampus(id: string, name: string): Promise<void> {
  await updateDoc(doc(db, "campuses", id), { name });
}

export async function deleteCampus(id: string): Promise<void> {
  const collegesSnapshot = await getDocs(query(collection(db, "colleges"), where("campusId", "==", id)));
  await Promise.all(collegesSnapshot.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(db, "campuses", id));
}
