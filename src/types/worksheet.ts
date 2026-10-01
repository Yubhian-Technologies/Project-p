export interface WorksheetAcademicYear {
  id: string;
  campusId: string;
  label: string;
  createdBy: string;
  createdAt: number;
}

export interface Worksheet {
  id: string;
  campusId: string;
  academicYearId: string;
  name: string;
  createdBy: string;
  createdAt: number;
}

export type WorksheetRowStatus = "pending" | "done";

export interface WorksheetRow {
  id: string;
  campusId: string;
  counsellorId: string;
  counsellorName: string;
  month: string;
  topic: string;
  dates: string;
  time: string;
  status: WorksheetRowStatus;
  order: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}
