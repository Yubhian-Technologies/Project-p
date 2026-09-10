import type { EventCategory } from "../types/event";

export const EVENT_CATEGORIES: { id: EventCategory; label: string }[] = [
  { id: "main-program", label: "Main Programs" },
  { id: "group-session", label: "Group Session" },
];

export const SESSION_YEAR_OPTIONS: { value: string; label: string }[] = [
  { value: "1", label: "Year 1" },
  { value: "2", label: "Year 2" },
  { value: "3", label: "Year 3" },
  { value: "4", label: "Year 4" },
  { value: "faculty", label: "Faculty" },
];

export function sessionYearLabel(value: string): string {
  return SESSION_YEAR_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function sortSessionYears(values: string[]): string[] {
  const order = SESSION_YEAR_OPTIONS.map((o) => o.value);
  return [...values].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

/** e.g. ["1","2"] -> "1, 2 years"; ["1","2","faculty"] -> "1, 2 years and Faculty"; ["faculty"] -> "Faculty" */
export function formatSessionYears(values: string[]): string {
  const sorted = sortSessionYears(values);
  const years = sorted.filter((v) => v !== "faculty");
  const hasFaculty = sorted.includes("faculty");
  const yearsText = years.length > 0 ? `${years.join(", ")} years` : "";
  if (yearsText && hasFaculty) return `${yearsText} and Faculty`;
  return yearsText || (hasFaculty ? "Faculty" : "");
}

export const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function monthRowLabel(month: number, calendarYear: number): string {
  return `${MONTH_LABELS[month]} ${calendarYear}`;
}
