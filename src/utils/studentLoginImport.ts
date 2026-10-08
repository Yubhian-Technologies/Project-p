import type { College } from "../types/college";

export interface StudentLoginRow {
  email: string;
  collegeId: string;
  collegeName: string;
  yearOrBatch?: string;
  branch?: string;
  gender?: string;
}

export interface BuildStudentLoginRowResult {
  row: StudentLoginRow | null;
  warnings: string[];
  invalidReason?: string;
}

function cellToString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function findColumn(headers: string[], keywords: string[]): number | undefined {
  const normalized = headers.map((h) => h.toLowerCase().trim());
  for (const keyword of keywords) {
    const index = normalized.findIndex((h) => h.includes(keyword));
    if (index !== -1) return index;
  }
  return undefined;
}

export async function parseLoginsSpreadsheet(file: File): Promise<{ headers: string[]; rows: unknown[][] }> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
  const [headerRow, ...dataRows] = rows;
  const headers = (headerRow ?? []).map((h) => (h === undefined || h === null ? "" : String(h)));
  return { headers, rows: dataRows.filter((r) => r && r.length > 0) };
}

export async function downloadLoginImportTemplate(): Promise<void> {
  const XLSX = await import("xlsx");
  const headers = ["Email", "Year / Batch", "Branch", "Gender", "College"];
  const exampleRow = ["student@example.com", "2nd Year", "CSE", "Female", "Example College"];
  const sheet = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Logins");
  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "student-logins-template.xlsx";
  link.click();
  URL.revokeObjectURL(url);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Builds and validates one row. `campusName` is only used to flag a
 * mismatched optional "Campus" column — the campus itself always comes from
 * the signed-in Head/Super Admin's own selection, never from the file.
 * `seenEmails` lets the caller dedupe repeated emails across the whole sheet
 * (passed in, mutated here). Year/Batch, Branch, and Gender are free text —
 * whatever's in the cell is stored as-is, no fixed set of values to validate
 * against (this varies too much across colleges to enforce here).
 */
export function buildStudentLoginRow(
  headers: string[],
  rawRow: unknown[],
  colleges: College[],
  campusName: string,
  seenEmails: Set<string>,
): BuildStudentLoginRowResult {
  const warnings: string[] = [];
  const emailIndex = findColumn(headers, ["email"]);
  const collegeIndex = findColumn(headers, ["college"]);
  const campusIndex = findColumn(headers, ["campus"]);
  const yearIndex = findColumn(headers, ["year", "batch"]);
  const branchIndex = findColumn(headers, ["branch"]);
  const genderIndex = findColumn(headers, ["gender"]);

  const email = cellToString(emailIndex !== undefined ? rawRow[emailIndex] : undefined).toLowerCase();
  if (!email) {
    return { row: null, warnings, invalidReason: "Missing email" };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { row: null, warnings, invalidReason: "Invalid email format" };
  }
  if (seenEmails.has(email)) {
    return { row: null, warnings, invalidReason: "Duplicate email in this file" };
  }

  if (campusIndex !== undefined) {
    const campusCell = cellToString(rawRow[campusIndex]);
    if (campusCell && campusCell.toLowerCase() !== campusName.toLowerCase()) {
      return { row: null, warnings, invalidReason: `Campus "${campusCell}" does not match your campus` };
    }
  }

  const collegeCell = cellToString(collegeIndex !== undefined ? rawRow[collegeIndex] : undefined);
  if (!collegeCell) {
    return { row: null, warnings, invalidReason: "Missing college" };
  }
  const college = colleges.find((c) => c.name.toLowerCase() === collegeCell.toLowerCase());
  if (!college) {
    return { row: null, warnings, invalidReason: `College "${collegeCell}" not found on your campus` };
  }

  const yearOrBatch = cellToString(yearIndex !== undefined ? rawRow[yearIndex] : undefined);
  const branch = cellToString(branchIndex !== undefined ? rawRow[branchIndex] : undefined);
  const gender = cellToString(genderIndex !== undefined ? rawRow[genderIndex] : undefined);

  seenEmails.add(email);
  return {
    row: {
      email,
      collegeId: college.id,
      collegeName: college.name,
      ...(yearOrBatch ? { yearOrBatch } : {}),
      ...(branch ? { branch } : {}),
      ...(gender ? { gender } : {}),
    },
    warnings,
  };
}
