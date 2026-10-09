import type { Campus } from "../types/campus";
import type { College } from "../types/college";

export interface StudentLoginRow {
  email: string;
  registerNumber: string;
  campusId: string;
  campusName: string;
  collegeId: string;
  collegeName: string;
  yearOrBatch?: string;
  admissionType?: "regular" | "lateral";
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

/** Never typed separately — always derived from the email's own local-part
    (the part before @), uppercased. Used for both bulk import and the
    one-at-a-time "Add User" flow; editable afterward via Edit User if a
    particular email doesn't actually follow this pattern. */
export function deriveRegisterNumber(email: string): string {
  return email.split("@")[0]?.toUpperCase() ?? "";
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
  const headers = ["Email", "Register Number", "Batch", "Regular / Lateral", "Branch", "Gender", "Campus", "College"];
  // Two example rows across two different campuses, to make it obvious one
  // file can mix campuses — each row is routed to its own Campus + College
  // independently. Register Number is optional — leave it blank and it's
  // derived automatically from Email, same as before.
  const exampleRows = [
    ["student1@example.com", "23PA1A0501", "2nd Year", "Regular", "CSE", "Female", "Example Campus", "Example College"],
    ["student2@example.com", "", "1st Year", "Lateral", "ECE", "Male", "Another Campus", "Another College"],
  ];
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...exampleRows]);
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
 * Builds and validates one row. `allowedCampuses` is the set of campuses this
 * row is permitted to resolve against — a Head passes just their own one
 * campus (so any other name in the sheet is rejected, same as before), a
 * Super Admin passes every campus (so one file can mix campuses — each row
 * routes to its own Campus + College independently). `colleges` is every
 * college across all of `allowedCampuses`; a row's College is matched only
 * within its own row's resolved campus, never across campuses.
 *
 * `seenEmails` lets the caller dedupe repeated emails across the whole sheet
 * (passed in, mutated here). Register Number, Batch, Branch, and Gender are
 * free text — whatever's in the cell is stored as-is, no fixed set of values
 * to validate against (this varies too much across colleges to enforce
 * here). Regular/Lateral is the one exception — it must read "Regular" or
 * "Lateral" (case-insensitive) or it's left blank with a warning, since it
 * drives a fixed dropdown in the UI. Register Number is optional — a blank
 * cell still falls back to being derived from Email, same as before.
 */
export function buildStudentLoginRow(
  headers: string[],
  rawRow: unknown[],
  allowedCampuses: Campus[],
  colleges: College[],
  seenEmails: Set<string>,
): BuildStudentLoginRowResult {
  const warnings: string[] = [];
  const emailIndex = findColumn(headers, ["email"]);
  const registerNumberIndex = findColumn(headers, ["register", "reg no", "regno"]);
  const collegeIndex = findColumn(headers, ["college"]);
  const campusIndex = findColumn(headers, ["campus"]);
  const yearIndex = findColumn(headers, ["year", "batch"]);
  const admissionTypeIndex = findColumn(headers, ["lateral", "admission"]);
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

  const campusCell = cellToString(campusIndex !== undefined ? rawRow[campusIndex] : undefined);
  let campus: Campus | undefined;
  if (campusCell) {
    campus = allowedCampuses.find((c) => c.name.toLowerCase() === campusCell.toLowerCase());
    if (!campus) {
      const reason =
        allowedCampuses.length === 1
          ? `Campus "${campusCell}" does not match your campus`
          : `Campus "${campusCell}" not found`;
      return { row: null, warnings, invalidReason: reason };
    }
  } else if (allowedCampuses.length === 1) {
    // Blank Campus cell defaults to the one campus available (Head's own, or
    // a Super Admin importing into a single pre-picked campus) — keeps older
    // sheets without a Campus column working unchanged.
    campus = allowedCampuses[0];
  } else {
    return { row: null, warnings, invalidReason: "Missing campus" };
  }

  const collegeCell = cellToString(collegeIndex !== undefined ? rawRow[collegeIndex] : undefined);
  if (!collegeCell) {
    return { row: null, warnings, invalidReason: "Missing college" };
  }
  const college = colleges.find(
    (c) => c.campusId === campus!.id && c.name.toLowerCase() === collegeCell.toLowerCase(),
  );
  if (!college) {
    return { row: null, warnings, invalidReason: `College "${collegeCell}" not found on campus "${campus.name}"` };
  }

  const yearOrBatch = cellToString(yearIndex !== undefined ? rawRow[yearIndex] : undefined);
  const branch = cellToString(branchIndex !== undefined ? rawRow[branchIndex] : undefined);
  const gender = cellToString(genderIndex !== undefined ? rawRow[genderIndex] : undefined);

  // Unlike Year/Batch, Branch, and Gender, this one's a controlled value (it
  // drives a dropdown in the UI) — an unrecognized cell is left blank with a
  // warning rather than stored as free text.
  const admissionTypeCell = cellToString(
    admissionTypeIndex !== undefined ? rawRow[admissionTypeIndex] : undefined,
  ).toLowerCase();
  let admissionType: "regular" | "lateral" | undefined;
  if (admissionTypeCell === "regular" || admissionTypeCell === "lateral") {
    admissionType = admissionTypeCell;
  } else if (admissionTypeCell) {
    warnings.push(`Unrecognized Regular/Lateral value "${admissionTypeCell}" — left blank`);
  }

  const registerNumberCell = cellToString(registerNumberIndex !== undefined ? rawRow[registerNumberIndex] : undefined);

  seenEmails.add(email);
  return {
    row: {
      email,
      registerNumber: registerNumberCell || deriveRegisterNumber(email),
      campusId: campus.id,
      campusName: campus.name,
      collegeId: college.id,
      collegeName: college.name,
      ...(yearOrBatch ? { yearOrBatch } : {}),
      ...(admissionType ? { admissionType } : {}),
      ...(branch ? { branch } : {}),
      ...(gender ? { gender } : {}),
    },
    warnings,
  };
}
