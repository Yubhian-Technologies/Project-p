import { useContext } from "react";
import { AcademicYearContext } from "../context/AcademicYearContext";

export function useAcademicYear() {
  const context = useContext(AcademicYearContext);
  if (!context) {
    throw new Error("useAcademicYear must be used within an AcademicYearProvider");
  }
  return context;
}
