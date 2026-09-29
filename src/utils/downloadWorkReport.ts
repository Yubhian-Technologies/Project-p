import type { WorkReport } from "../services/firebase/workReports";

const TYPE_LABELS: Record<WorkReport["reportType"], string> = {
  daily: "Daily Report",
  weekly: "Weekly Report",
  consolidated: "Consolidated Report",
  other: "Other",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** Saves a work report to the user's device as a PDF. */
export async function downloadWorkReport(report: WorkReport): Promise<void> {
  // Loaded on demand so the PDF library isn't part of the main bundle.
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const margin = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const textWidth = pageWidth - margin * 2;
  let y = margin;

  function write(text: string, size: number, bold = false, gap = 6, color: [number, number, number] = [15, 23, 42]) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lineHeight = size * 1.4;
    for (const line of doc.splitTextToSize(text, textWidth) as string[]) {
      if (y + lineHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    }
    y += gap;
  }

  function rule() {
    doc.setDrawColor(43, 43, 43);
    doc.setLineWidth(1);
    doc.line(margin, y, pageWidth - margin, y);
    y += 14;
  }

  write("Vishnu Wellness · Work Report", 10, true, 4, [124, 58, 237]);
  write(report.title, 20, true, 8);
  rule();

  const meta: [string, string][] = [
    ["Type", TYPE_LABELS[report.reportType] ?? report.reportType],
    ["Period", report.periodLabel],
    ["Submitted by", report.submittedBy],
    ["Submitted on", formatDate(report.submittedAt)],
    ["Status", report.status === "verified" ? "Verified" : "Pending"],
  ];
  for (const [label, value] of meta) write(`${label}: ${value}`, 11, false, 2);
  y += 8;
  rule();

  write("Report Content", 12, true, 6);
  write(report.body, 11, false, 12);

  if (report.status === "verified") {
    rule();
    write("Head Verification Notes", 12, true, 6);
    const by = `Verified by ${report.verifiedBy ?? "Head"}${report.verifiedAt ? ` on ${formatDate(report.verifiedAt)}` : ""}`;
    write(by, 11, true, 2);
    write(report.headNotes || "No additional remarks.", 11, false, 0);
  }

  const safeName = report.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "work-report";
  doc.save(`${safeName}.pdf`);
}
