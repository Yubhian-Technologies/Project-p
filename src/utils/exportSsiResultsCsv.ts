import type { SsiCollegeResult } from "../services/firebase/ssiCollegeResults";
import { SSI_SEVERITY_LABELS } from "../config/ssiForm";
import { downloadCsv } from "./csvExport";

function answerFor(result: SsiCollegeResult, questionId: string): string {
  return result.level3Answers.find((a) => a.id === questionId)?.answer ?? "";
}

const HEADERS = [
  "Name",
  "Email",
  "Department",
  "Year",
  "Section",
  "Hostel / Day Scholar",
  "Age",
  "WhatsApp Number",
  "Total Score",
  "Max Score",
  "Depression",
  "Anxiety",
  "Stress",
  "Severity",
  "Thoughts of self-harm",
  "Witnessed traumatic event",
  "Wants counsellor support",
  "Submitted At",
];

/** Downloads the given SSI college results as a CSV file — no external library needed. */
export function exportSsiResultsCsv(results: SsiCollegeResult[], filename = "ssi-test-results.csv"): void {
  const rows = results.map((r) => [
    r.displayName,
    r.userEmail,
    r.level1.department ?? "",
    r.level1.year ?? "",
    r.level1.section ?? "",
    r.level1.hostelOrDayScholar ?? "",
    r.level1.age ?? "",
    r.whatsappNumber,
    r.likertScore,
    r.likertMax,
    r.depressionScore,
    r.anxietyScore,
    r.stressScore,
    SSI_SEVERITY_LABELS[r.severity],
    answerFor(r, "l3_q1"),
    answerFor(r, "l3_q2"),
    answerFor(r, "l3_q4"),
    new Date(r.submittedAt).toLocaleString(),
  ]);

  downloadCsv(filename, HEADERS, rows);
}
