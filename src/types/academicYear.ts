export interface AcademicYearExportInfo {
  at: number;
  byUid: string;
  counts: { sessions: number; crisisSos?: number; seriousCases?: number; feedback: number; ssiResults: number; events: number };
  archivedRecordCount?: number;
  selectedTypes?: string[];
}

/** Summary kept on the year after a college's raw data was deleted. */
export interface AcademicYearArchiveSummary {
  deletedAt: number;
  byUid: string;
  archivedRecordCount?: number;
  sessions: number;
  completedSessions: number;
  missedSessions: number;
  feedbackCount: number;
  averageRating: number | null;
  ssiResults: number;
  ssiSevere: number;
  ssiMedium: number;
  ssiNormal: number;
  events: number;
}

export type AcademicYearStatus = "active" | "closed";

// One academic year of a campus — the colleges listed in `collegeIds` follow
// this year's date range. A college can belong to only one year at a time for
// any given date, i.e. years never overlap for the same college (enforced by
// the saveAcademicYear Cloud Function, not just the UI).
export interface AcademicYear {
  id: string;
  campusId: string;
  label: string; // e.g. "2025–26"
  startDate: number; // epoch ms, start of the first day
  endDate: number; // epoch ms, end of the last day
  collegeIds: string[];
  status: AcademicYearStatus;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  /** Per college: set when its data was last exported (required before delete). */
  exports?: Record<string, AcademicYearExportInfo>;
  /** Per college: set once its data was deleted; holds the kept summary. */
  archive?: Record<string, AcademicYearArchiveSummary>;
}
