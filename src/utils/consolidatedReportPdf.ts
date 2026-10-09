import { jsPDF } from "jspdf";
import type { ReportSection, ReportStatRow } from "../types/report";
import type { ConsolidatedReportData } from "./consolidatedReportData";

export interface ConsolidatedReportHeaderInfo {
  monthLabel: string; // "AUGUST 2026"
}

export interface ConsolidatedReportInput {
  header: ConsolidatedReportHeaderInfo;
  extraStats: ReportStatRow[];
  sections: ReportSection[];
  data: ConsolidatedReportData;
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

function wrapText(doc: jsPDF, text: string, x: number, y: number, width: number, lineHeight: number): number {
  const lines = doc.splitTextToSize(text, width);
  doc.text(lines, x, y);
  return lines.length * lineHeight;
}

export async function generateConsolidatedReportPdf(input: ConsolidatedReportInput): Promise<void> {
  const { header, extraStats, sections, data, photos } = input;
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

  doc.setFontSize(16).setFont("helvetica", "bold").text("SHRI VISHNU EDUCATIONAL SOCIETY", margin, y);
  y += 20;
  doc.setFontSize(13).text("VISHNU WELLNESS CENTRE", margin, y);
  y += 18;
  doc.setFontSize(14).text(`CONSOLIDATED MONTHLY REPORT – ${header.monthLabel}`, margin, y);
  y += 30;

  // Executive Summary
  doc.setFontSize(13).text("1. Executive Summary", margin, y);
  y += 20;
  doc.setFontSize(10.5).setFont("helvetica", "bold");
  doc.text("Particulars", margin, y);
  doc.text(header.monthLabel, margin + contentWidth * 0.65, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  const execRows: [string, string][] = [
    ["Institutions Covered / Represented", String(data.institutionsCovered)],
    ["Individual Counselling Sessions Reported", String(data.totalSessions)],
    ["Student Group Sessions Reported", String(data.groupSessionsCount)],
    ...extraStats.filter((s) => s.label.trim()).map((s) => [s.label.trim(), s.value.trim()] as [string, string]),
  ];
  for (const [label, value] of execRows) {
    ensureSpace(20);
    const used = wrapText(doc, label, margin, y, contentWidth * 0.6, 13);
    doc.text(value, margin + contentWidth * 0.65, y);
    y += Math.max(used, 14) + 4;
  }
  y += 16;

  // Institution-wise Counselling Summary
  ensureSpace(60);
  doc.setFontSize(13).text("2. Institution-wise Counselling Summary", margin, y);
  y += 20;
  doc.setFontSize(10.5).setFont("helvetica", "bold");
  doc.text("Institution / Area", margin, y);
  doc.text("Counsellor(s)", margin + contentWidth * 0.4, y);
  doc.text("Sessions", margin + contentWidth * 0.85, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  for (const row of data.institutions) {
    ensureSpace(20);
    const used = wrapText(doc, row.collegeName, margin, y, contentWidth * 0.38, 13);
    wrapText(doc, row.counsellorNames.join(", ") || "—", margin + contentWidth * 0.4, y, contentWidth * 0.43, 13);
    doc.text(String(row.sessions), margin + contentWidth * 0.85, y);
    y += Math.max(used, 14) + 6;
  }
  doc.setFont("helvetica", "bold");
  doc.text("Total Reported Sessions", margin, y);
  doc.text(String(data.totalSessions), margin + contentWidth * 0.85, y);
  y += 30;

  // Narrative sections
  let sectionNumber = 3;
  for (const section of sections) {
    if (!section.heading.trim() && section.items.every((it) => !it.details.trim())) continue;
    ensureSpace(40);
    doc.setFontSize(13).setFont("helvetica", "bold").text(`${sectionNumber}. ${section.heading || "Untitled Section"}`, margin, y);
    sectionNumber += 1;
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

  for (const file of photos) {
    const dataUrl = await fileToDataUrl(file);
    doc.addPage();
    const imgProps = doc.getImageProperties(dataUrl);
    const maxW = contentWidth;
    const maxH = pageHeight - margin * 2;
    const scale = Math.min(maxW / imgProps.width, maxH / imgProps.height, 1);
    doc.addImage(dataUrl, imgProps.fileType, margin, margin, imgProps.width * scale, imgProps.height * scale);
  }

  doc.save(`consolidated-report-${header.monthLabel.replace(/\s/g, "-")}.pdf`);
}
