import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./config";
import type { AcademicYear } from "../../types/academicYear";

const academicYearsCollection = collection(db, "academicYears");

// Always queried per campus — the read rule is evaluated against campusId, so
// Firestore can only allow the query when it filters on it.
export async function listAcademicYearsForCampus(campusId: string): Promise<AcademicYear[]> {
  const snapshot = await getDocs(query(academicYearsCollection, where("campusId", "==", campusId)));
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }) as AcademicYear)
    .sort((a, b) => b.startDate - a.startDate);
}

export async function listAcademicYearsForCampuses(campusIds: string[]): Promise<AcademicYear[]> {
  const lists = await Promise.all(campusIds.map(listAcademicYearsForCampus));
  return lists.flat().sort((a, b) => b.startDate - a.startDate);
}
