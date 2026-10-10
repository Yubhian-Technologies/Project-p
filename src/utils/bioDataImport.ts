import type { StudentBioData, UserProfile } from "../types/user";

export interface BioDataImportRow {
  uid: string;
  registerNumber: string;
  // Student's own account, for display/cross-check in the preview table —
  // never written to by this import, only Register Number is used to match.
  accountName: string;
  accountEmail: string;
  bioData: StudentBioData;
}

export interface BuildBioDataRowResult {
  row: BioDataImportRow | null;
  warnings: string[];
  invalidReason?: string;
}

function cellToString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

// The field only accepts these two exact values — a free-typed sheet cell
// ("H", "Day Scholor", "DS", etc.) needs normalizing instead of a straight
// store-as-is like the other bio-data columns.
function normalizeHostelOrDayScholar(raw: string): "Hostel" | "Day Scholar" | undefined {
  const key = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (key === "hostel" || key === "hosteller" || key === "h") return "Hostel";
  if (key === "dayscholar" || key === "dayscholor" || key === "ds") return "Day Scholar";
  return undefined;
}

// Unlike the simple "first keyword that matches" lookup used for student
// logins, bio-data columns often share a word (e.g. "Name" appears in
// "Name", "Father's Name", "Mother's Name") — this requires every keyword
// in `mustInclude` to be present and none of `mustExclude`, so a column is
// found correctly no matter what order the sheet's own columns are in.
function findColumn(headers: string[], mustInclude: string[], mustExclude: string[] = []): number | undefined {
  const normalized = headers.map((h) => h.toLowerCase().trim());
  const index = normalized.findIndex(
    (h) => mustInclude.every((k) => h.includes(k)) && !mustExclude.some((k) => h.includes(k)),
  );
  return index === -1 ? undefined : index;
}

export async function downloadBioDataImportTemplate(): Promise<void> {
  const XLSX = await import("xlsx");
  const headers = [
    "Register Number",
    "Name",
    "Branch",
    "Batch",
    "Course",
    "Date of Birth",
    "Hostel / Day Scholar",
    "Gender",
    "Mobile Number",
    "Email ID (Personal)",
    "Father's Name",
    "Mother's Name",
    "Father's Occupation",
    "Mother's Occupation",
    "Father's Phone Number",
    "Mother's Phone Number",
    "Father's Email ID",
    "Mother's Email ID",
    "Correspondence Address",
    "Permanent Address",
  ];
  // Name/Branch/Batch/Gender are included only so whoever fills this sheet
  // can visually confirm each row is the right student — the import itself
  // matches purely by Register Number and only ever writes the bio-data
  // columns, never these four (they're already managed elsewhere).
  const exampleRow = [
    "23PA1A0501",
    "Student Name",
    "CSE",
    "2023-27",
    "B.Tech",
    "2005-06-15",
    "Hostel",
    "Female",
    "9876543210",
    "student.personal@example.com",
    "Father Name",
    "Mother Name",
    "Business",
    "Teacher",
    "9876500001",
    "9876500002",
    "father@example.com",
    "mother@example.com",
    "123 Street, City, State, PIN",
    "456 Street, City, State, PIN",
  ];
  const sheet = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Bio Data");
  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "bio-data-import-template.xlsx";
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Builds and validates one row, matching purely on Register Number against
 * `studentsByRegisterNumber` (every existing "user"-role account, keyed by
 * their register number uppercased/trimmed — the same normalization applied
 * to the sheet's own cell before lookup). Every bio-data column is free
 * text, stored as-is; a blank cell just leaves that field unset rather than
 * clearing it (so a partial sheet can't blank out fields filled in earlier
 * some other way). `seenRegisterNumbers` dedupes repeats within one sheet
 * (passed in, mutated here).
 */
export function buildBioDataRow(
  headers: string[],
  rawRow: unknown[],
  studentsByRegisterNumber: Map<string, UserProfile>,
  seenRegisterNumbers: Set<string>,
): BuildBioDataRowResult {
  const warnings: string[] = [];
  const registerNumberIndex = findColumn(headers, ["register"]);
  const nameIndex = findColumn(headers, ["name"], ["father", "mother"]);
  const branchIndex = findColumn(headers, ["branch"]);
  const batchIndex = findColumn(headers, ["batch"]);
  const courseIndex = findColumn(headers, ["course"]);
  const dobIndex = findColumn(headers, ["birth"]);
  const hostelOrDayScholarIndex = findColumn(headers, ["hostel"]);
  const genderIndex = findColumn(headers, ["gender"]);
  const mobileIndex = findColumn(headers, ["mobile"]);
  const personalEmailIndex = findColumn(headers, ["email"], ["father", "mother"]);
  const fatherNameIndex = findColumn(headers, ["father", "name"]);
  const motherNameIndex = findColumn(headers, ["mother", "name"]);
  const fatherOccupationIndex = findColumn(headers, ["father", "occupation"]);
  const motherOccupationIndex = findColumn(headers, ["mother", "occupation"]);
  const fatherPhoneIndex = findColumn(headers, ["father", "phone"]);
  const motherPhoneIndex = findColumn(headers, ["mother", "phone"]);
  const fatherEmailIndex = findColumn(headers, ["father", "email"]);
  const motherEmailIndex = findColumn(headers, ["mother", "email"]);
  const correspondenceAddressIndex = findColumn(headers, ["correspondence"]);
  const permanentAddressIndex = findColumn(headers, ["permanent"]);

  const registerNumberCell = cellToString(
    registerNumberIndex !== undefined ? rawRow[registerNumberIndex] : undefined,
  ).toUpperCase();
  if (!registerNumberCell) {
    return { row: null, warnings, invalidReason: "Missing Register Number" };
  }
  if (seenRegisterNumbers.has(registerNumberCell)) {
    return { row: null, warnings, invalidReason: "Duplicate Register Number in this file" };
  }

  const student = studentsByRegisterNumber.get(registerNumberCell);
  if (!student) {
    return { row: null, warnings, invalidReason: `No student found with Register Number "${registerNumberCell}"` };
  }

  // Name/Branch/Batch/Gender are shown for confirmation, but never block or
  // change anything — just a heads-up if the sheet's row looks like it might
  // be the wrong student.
  const sheetName = cellToString(nameIndex !== undefined ? rawRow[nameIndex] : undefined);
  if (sheetName && student.displayName && sheetName.toLowerCase() !== student.displayName.toLowerCase()) {
    warnings.push(`Sheet Name "${sheetName}" doesn't match this account's Name "${student.displayName}"`);
  }
  const sheetBranch = cellToString(branchIndex !== undefined ? rawRow[branchIndex] : undefined);
  if (sheetBranch && student.branch && sheetBranch.toLowerCase() !== student.branch.toLowerCase()) {
    warnings.push(`Sheet Branch "${sheetBranch}" doesn't match this account's Branch "${student.branch}"`);
  }
  const sheetBatch = cellToString(batchIndex !== undefined ? rawRow[batchIndex] : undefined);
  if (sheetBatch && student.yearOrBatch && sheetBatch.toLowerCase() !== student.yearOrBatch.toLowerCase()) {
    warnings.push(`Sheet Batch "${sheetBatch}" doesn't match this account's Batch "${student.yearOrBatch}"`);
  }
  const sheetGender = cellToString(genderIndex !== undefined ? rawRow[genderIndex] : undefined);
  if (sheetGender && student.gender && sheetGender.toLowerCase() !== student.gender.toLowerCase()) {
    warnings.push(`Sheet Gender "${sheetGender}" doesn't match this account's Gender "${student.gender}"`);
  }

  function cell(index: number | undefined): string | undefined {
    const value = cellToString(index !== undefined ? rawRow[index] : undefined);
    return value || undefined;
  }

  const hostelOrDayScholarCell = cell(hostelOrDayScholarIndex);
  const hostelOrDayScholar = hostelOrDayScholarCell
    ? normalizeHostelOrDayScholar(hostelOrDayScholarCell)
    : undefined;
  if (hostelOrDayScholarCell && !hostelOrDayScholar) {
    warnings.push(`Hostel / Day Scholar value "${hostelOrDayScholarCell}" wasn't recognized and was left unset`);
  }

  const fromSheet: StudentBioData = {
    course: cell(courseIndex),
    dateOfBirth: cell(dobIndex),
    hostelOrDayScholar,
    mobileNumber: cell(mobileIndex),
    personalEmail: cell(personalEmailIndex),
    fatherName: cell(fatherNameIndex),
    motherName: cell(motherNameIndex),
    fatherOccupation: cell(fatherOccupationIndex),
    motherOccupation: cell(motherOccupationIndex),
    fatherPhone: cell(fatherPhoneIndex),
    motherPhone: cell(motherPhoneIndex),
    fatherEmail: cell(fatherEmailIndex),
    motherEmail: cell(motherEmailIndex),
    correspondenceAddress: cell(correspondenceAddressIndex),
    permanentAddress: cell(permanentAddressIndex),
  };
  // Drop keys that ended up undefined so a blank cell doesn't overwrite an
  // existing value with `undefined` (Firestore would reject that write).
  (Object.keys(fromSheet) as (keyof StudentBioData)[]).forEach((key) => {
    if (fromSheet[key] === undefined) delete fromSheet[key];
  });

  if (Object.keys(fromSheet).length === 0) {
    return { row: null, warnings, invalidReason: "No bio-data values in this row" };
  }

  // The write replaces the whole `bioData` object on that account (Firestore
  // doesn't deep-merge nested maps), so this starts from whatever's already
  // there and layers the sheet's values on top — a blank cell in the sheet
  // never wipes out a field the student (or an earlier import) already set.
  const bioData: StudentBioData = { ...student.bioData, ...fromSheet };

  seenRegisterNumbers.add(registerNumberCell);
  return {
    row: {
      uid: student.uid,
      registerNumber: registerNumberCell,
      accountName: student.displayName || student.email,
      accountEmail: student.email,
      bioData,
    },
    warnings,
  };
}
