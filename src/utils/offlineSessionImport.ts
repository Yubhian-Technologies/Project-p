export type ImportField =
  | "clientName"
  | "date"
  | "time"
  | "duration"
  | "occupation"
  | "whatsapp"
  | "issue"
  | "summary"
  | "userRating"
  | "counsellorRating"
  | "counsellorNote";

export const IMPORT_FIELDS: { id: ImportField; label: string; required?: boolean }[] = [
  { id: "clientName", label: "Client name", required: true },
  { id: "date", label: "Session date", required: true },
  { id: "time", label: "Session time" },
  { id: "duration", label: "Duration (minutes)" },
  { id: "occupation", label: "Occupation" },
  { id: "whatsapp", label: "WhatsApp / phone" },
  { id: "issue", label: "Issue / topic" },
  { id: "summary", label: "Session summary" },
  { id: "userRating", label: "Client's rating of counsellor (1-5)" },
  { id: "counsellorRating", label: "Counsellor's rating of client (1-5)" },
  { id: "counsellorNote", label: "Counsellor's private note" },
];

const FIELD_KEYWORDS: Record<ImportField, string[]> = {
  clientName: ["name", "client"],
  date: ["date"],
  time: ["time"],
  duration: ["duration", "minutes", "mins"],
  occupation: ["occupation"],
  whatsapp: ["whatsapp", "phone", "contact", "mobile"],
  issue: ["issue", "topic"],
  summary: ["summary", "notes", "session notes"],
  userRating: ["client rating", "rating of counsellor", "rating"],
  counsellorRating: ["counsellor rating", "rating of client"],
  counsellorNote: ["counsellor note", "note on client", "private note"],
};

export interface OfflineSessionRow {
  clientName: string;
  scheduledAt: number;
  durationMinutes: number;
  occupation: "student" | "professional";
  whatsappNumber: string;
  issue: string;
  summary?: string;
  userRating?: number;
  counsellorRating?: number;
  counsellorNote?: string;
  clientEmail?: string;
}

const DEFAULT_DURATION_MINUTES = 90;

export async function parseSpreadsheet(file: File): Promise<{ headers: string[]; rows: unknown[][] }> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
  const [headerRow, ...dataRows] = rows;
  const headers = (headerRow ?? []).map((h) => (h === undefined || h === null ? "" : String(h)));
  return { headers, rows: dataRows.filter((r) => r && r.length > 0) };
}

const TEMPLATE_EXAMPLE_ROW = [
  "Priya Sharma",
  new Date(2026, 0, 15),
  "3:30 PM",
  90,
  "Student",
  "9876543210",
  "Exam stress",
  "Discussed coping strategies, follow-up recommended.",
  5,
  4,
  "Responded well to CBT techniques.",
];

/**
 * Builds a ready-to-use sample sheet with the exact column names the fuzzy
 * matcher recognizes best, plus one filled-in example row — for anyone who
 * doesn't already have an offline log, or wants a known-good starting point
 * instead of relying on column mapping for their own sheet's headers.
 */
export async function downloadImportTemplate(): Promise<void> {
  const XLSX = await import("xlsx");
  const headers = IMPORT_FIELDS.map((f) => f.label);
  const sheet = XLSX.utils.aoa_to_sheet([headers, TEMPLATE_EXAMPLE_ROW]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Offline Sessions");
  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "offline-sessions-template.xlsx";
  link.click();
  URL.revokeObjectURL(url);
}

export function guessColumnMapping(headers: string[]): Partial<Record<ImportField, number>> {
  const mapping: Partial<Record<ImportField, number>> = {};
  const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());

  for (const field of Object.keys(FIELD_KEYWORDS) as ImportField[]) {
    const keywords = FIELD_KEYWORDS[field];
    let bestIndex: number | undefined;
    let bestKeywordLength = -1;
    normalizedHeaders.forEach((header, index) => {
      for (const keyword of keywords) {
        if (header.includes(keyword) && keyword.length > bestKeywordLength) {
          bestIndex = index;
          bestKeywordLength = keyword.length;
        }
      }
    });
    if (bestIndex !== undefined) mapping[field] = bestIndex;
  }

  // "rating" alone is ambiguous between userRating/counsellorRating — if both keyword
  // sets matched the same column, prefer userRating (the more commonly logged one)
  // and leave counsellorRating unmapped rather than double-assign the same index.
  if (mapping.userRating !== undefined && mapping.counsellorRating === mapping.userRating) {
    delete mapping.counsellorRating;
  }

  return mapping;
}

function cellToString(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (value instanceof Date) return value.toLocaleDateString();
  return String(value).trim();
}

function extractDateParts(value: unknown): { year: number; month: number; day: number } | null {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return { year: value.getFullYear(), month: value.getMonth(), day: value.getDate() };
  }
  const str = cellToString(value);
  if (!str) return null;
  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) return null;
  return { year: parsed.getFullYear(), month: parsed.getMonth(), day: parsed.getDate() };
}

function extractTimeParts(value: unknown): { hours: number; minutes: number } | null {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return { hours: value.getHours(), minutes: value.getMinutes() };
  }
  const str = cellToString(value);
  if (!str) return null;
  const match = str.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3]?.toUpperCase();
  if (ampm === "PM" && hours < 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

export function normalizeEmail(value: unknown): string {
  const str = cellToString(value);
  return str.includes("@") ? str.toLowerCase() : "";
}

export function normalizePhone(value: unknown): string {
  const digits = cellToString(value).replace(/\D/g, "");
  return digits.length >= 6 ? digits : "";
}

function parseRating(value: unknown): number | undefined {
  const str = cellToString(value);
  if (!str) return undefined;
  const n = Number(str);
  if (!Number.isFinite(n) || n < 1 || n > 5) return undefined;
  return n;
}

function guessOccupation(value: unknown): "student" | "professional" {
  const str = cellToString(value).toLowerCase();
  return str.includes("stud") ? "student" : "professional";
}

export interface BuildRowResult {
  row: OfflineSessionRow | null;
  warnings: string[];
  invalidReason?: string;
}

export function buildOfflineSessionRow(
  rawRow: unknown[],
  mapping: Partial<Record<ImportField, number>>,
): BuildRowResult {
  const warnings: string[] = [];
  const get = (field: ImportField) => (mapping[field] !== undefined ? rawRow[mapping[field]!] : undefined);

  const clientName = cellToString(get("clientName"));
  if (!clientName) {
    return { row: null, warnings, invalidReason: "Missing client name" };
  }

  const dateParts = extractDateParts(get("date"));
  if (!dateParts) {
    return { row: null, warnings, invalidReason: "Missing or unreadable session date" };
  }

  const timeParts = extractTimeParts(get("time"));
  const { hours, minutes } = timeParts ?? { hours: 12, minutes: 0 };
  if (!timeParts && mapping.time !== undefined) {
    warnings.push("Time not recognized — defaulted to 12:00 PM");
  }
  const scheduledAt = new Date(dateParts.year, dateParts.month, dateParts.day, hours, minutes).getTime();

  let durationMinutes = DEFAULT_DURATION_MINUTES;
  const durationRaw = get("duration");
  if (durationRaw !== undefined) {
    const parsedDuration = Number(cellToString(durationRaw));
    if (Number.isFinite(parsedDuration) && parsedDuration > 0) {
      durationMinutes = parsedDuration;
    } else {
      warnings.push(`Duration not recognized — defaulted to ${DEFAULT_DURATION_MINUTES} minutes`);
    }
  }

  const userRatingRaw = get("userRating");
  const userRating = parseRating(userRatingRaw);
  if (userRatingRaw !== undefined && cellToString(userRatingRaw) && userRating === undefined) {
    warnings.push("Client rating out of range (1-5) — ignored");
  }

  const counsellorRatingRaw = get("counsellorRating");
  const counsellorRating = parseRating(counsellorRatingRaw);
  if (counsellorRatingRaw !== undefined && cellToString(counsellorRatingRaw) && counsellorRating === undefined) {
    warnings.push("Counsellor rating out of range (1-5) — ignored");
  }

  const email = normalizeEmail(get("whatsapp"));

  const row: OfflineSessionRow = {
    clientName,
    scheduledAt,
    durationMinutes,
    occupation: guessOccupation(get("occupation")),
    whatsappNumber: cellToString(get("whatsapp")),
    issue: cellToString(get("issue")),
    summary: cellToString(get("summary")) || undefined,
    userRating,
    counsellorRating,
    counsellorNote: cellToString(get("counsellorNote")) || undefined,
    clientEmail: email || undefined,
  };

  return { row, warnings };
}

/**
 * Derives a stable synthetic userId so the same walk-in client across multiple
 * rows/imports collapses into one identity. Only collapses when there's strong
 * contact info (email or phone) — two different real clients can share a name,
 * so a name-only fallback would silently merge unrelated people's histories.
 */
export function syntheticClientId(email: string | undefined, phone: string): string {
  const normalizedEmail = email ? email.toLowerCase().trim() : "";
  const normalizedPhone = phone.replace(/\D/g, "");
  if (normalizedEmail) return `offline:${normalizedEmail}`;
  if (normalizedPhone.length >= 6) return `offline:${normalizedPhone}`;
  const randomId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return `offline:${randomId}`;
}

export function clientDisplayLabel(clientName: string, phone: string): string {
  return phone ? `${clientName} (${phone})` : clientName;
}
