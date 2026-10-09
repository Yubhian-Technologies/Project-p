import { jsPDF } from "jspdf";
import type { ReportSection } from "../types/report";
import type { MonthlySessionData } from "./monthlyReportData";

export interface MonthlyReportHeaderInfo {
  monthLabel: string; // "AUGUST 2026"
  nextMonthLabel: string; // "September 2026"
  preparedByName: string;
  roleTitle: string;
  institutionName: string;
}

export interface MonthlyReportInput {
  header: MonthlyReportHeaderInfo;
  sections: ReportSection[];
  goals: string[];
  sessionData: MonthlySessionData;
  photos: File[];
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Splits a long string across multiple lines at `width`, returns how many
// lines it took so callers can advance `y` by the right amount.
function wrapText(doc: jsPDF, text: string, x: number, y: number, width: number, lineHeight: number): number {
  const lines = doc.splitTextToSize(text, width);
  doc.text(lines, x, y);
  return lines.length * lineHeight;
}

export async function generateMonthlyReportPdf(input: MonthlyReportInput): Promise<void> {
  const { header, sections, goals, sessionData, photos } = input;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  let y = 56;

  function ensureSpace(needed: number) {
    if (y + needed > pageHeight - 40) {
      doc.addPage();
      y = 50;
    }
  }

  doc.setFontSize(18).setFont("helvetica", "bold").text(`MONTHLY REPORT – ${header.monthLabel}`, margin, y);
  y += 26;
  doc.setFontSize(11).setFont("helvetica", "normal");
  doc.text(`In-Charge Psychologist: ${header.preparedByName}`, margin, y);
  y += 16;
  doc.text("Department: Vishnu Wellness Centre", margin, y);
  y += 16;
  doc.text(`Institution: ${header.institutionName}`, margin, y);
  y += 28;

  for (const section of sections) {
    if (!section.heading.trim() && section.items.every((it) => !it.details.trim())) continue;
    ensureSpace(40);
    doc.setFontSize(13).setFont("helvetica", "bold").text(section.heading || "Untitled Section", margin, y);
    y += 18;
    doc.setFontSize(10.5).setFont("helvetica", "normal");
    for (const item of section.items) {
      if (!item.details.trim() && !item.title.trim()) continue;
      ensureSpace(30);
      const text = item.title.trim() ? `${item.title.trim()}: ${item.details.trim()}` : item.details.trim();
      const used = wrapText(doc, `•  ${text}`, margin, y, contentWidth, 13);
      y += used + 6;
    }
    y += 12;
  }

  // Counselling sessions table
  ensureSpace(40 + sessionData.weeks.length * 20);
  doc.setFontSize(13).setFont("helvetica", "bold").text(`Counselling Sessions – ${header.monthLabel}`, margin, y);
  y += 20;
  doc.setFontSize(10.5).setFont("helvetica", "bold");
  doc.text(header.monthLabel, margin, y);
  doc.text("Number of Sessions", margin + contentWidth * 0.6, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  for (const week of sessionData.weeks) {
    ensureSpace(20);
    doc.text(`${week.dateRangeLabel} (${week.label})`, margin, y);
    doc.text(String(week.sessions), margin + contentWidth * 0.6, y);
    y += 16;
  }
  doc.setFont("helvetica", "bold");
  doc.text("Total", margin, y);
  doc.text(String(sessionData.total), margin + contentWidth * 0.6, y);
  y += 30;

  if (goals.length > 0) {
    ensureSpace(30);
    doc.setFontSize(13).text(`Goals for the Upcoming Month – ${header.nextMonthLabel}`, margin, y);
    y += 20;
    doc.setFontSize(10.5).setFont("helvetica", "normal");
    goals.forEach((goal, i) => {
      if (!goal.trim()) return;
      ensureSpace(24);
      const used = wrapText(doc, `${i + 1}. ${goal.trim()}`, margin, y, contentWidth, 13);
      y += used + 6;
    });
    y += 16;
  }

  ensureSpace(70);
  doc.setFontSize(11).setFont("helvetica", "normal").text("Prepared by:", margin, y);
  y += 16;
  doc.setFont("helvetica", "bold").text(header.preparedByName, margin, y);
  y += 16;
  doc.setFont("helvetica", "italic").text(header.roleTitle || "Wellness Counsellor", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal").text("Vishnu Wellness Centre", margin, y);

  for (const file of photos) {
    const dataUrl = await fileToDataUrl(file);
    doc.addPage();
    const imgProps = doc.getImageProperties(dataUrl);
    const maxW = contentWidth;
    const maxH = pageHeight - margin * 2;
    const scale = Math.min(maxW / imgProps.width, maxH / imgProps.height, 1);
    doc.addImage(dataUrl, imgProps.fileType, margin, margin, imgProps.width * scale, imgProps.height * scale);
  }

  doc.save(`monthly-report-${header.monthLabel.replace(/\s/g, "-")}.pdf`);
}
