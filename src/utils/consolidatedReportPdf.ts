import { jsPDF } from "jspdf";
import type { ReportSection, ReportStatRow } from "../types/report";
import type { ConsolidatedReportData } from "./consolidatedReportData";
import { loadMonthlyReportLogo } from "./monthlyReportImages";

export interface ConsolidatedReportHeaderInfo {
  monthLabel: string;
}

export interface ConsolidatedReportInput {
  header: ConsolidatedReportHeaderInfo;
  extraStats: ReportStatRow[];
  sections: ReportSection[];
  data: ConsolidatedReportData;
  photos: File[];
}

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function wrapText(doc: jsPDF, text: string, width: number): string[] {
  return doc.splitTextToSize(text, width);
}

export async function generateConsolidatedReportPdf(input: ConsolidatedReportInput): Promise<Blob> {
  const { header, extraStats, sections, data, photos } = input;
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  function newPage() {
    doc.addPage();
    y = 42;
  }

  function ensureSpace(height: number) {
    if (y + height > pageHeight - margin) newPage();
  }

  const logo = await fileToDataUrl(await loadMonthlyReportLogo());
  const logoWidth = 76;
  const logoHeight = logoWidth * (379 / 447);
  doc.addImage(logo, "JPEG", (pageWidth - logoWidth) / 2, 18, logoWidth, logoHeight);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.7);
  doc.line(margin, 92, pageWidth - margin, 92);
  y = 116;
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold").setFontSize(16);
  doc.text(`CONSOLIDATED MONTHLY REPORT — ${header.monthLabel}`, pageWidth / 2, y, { align: "center" });
  y += 18;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(100, 116, 139);
  doc.text(data.campusName, pageWidth / 2, y, { align: "center" });
  y += 28;

  function drawTable(
    title: string,
    headers: string[],
    rows: string[][],
    columnRatios: number[],
    boldLastRow = false,
  ) {
    ensureSpace(50);
    doc.setTextColor(15, 23, 42).setFont("helvetica", "bold").setFontSize(12);
    doc.text(title, margin, y);
    y += 12;

    const widths = columnRatios.map((ratio) => contentWidth * ratio);
    const rowPadding = 6;
    const lineHeight = 11;

    function drawRow(cells: string[], isHeader: boolean, isBold: boolean) {
      const cellLines = cells.map((cell, index) => wrapText(doc, cell, widths[index] - rowPadding * 2));
      const rowHeight = Math.max(22, ...cellLines.map((lines) => lines.length * lineHeight + rowPadding * 2));
      if (y + rowHeight > pageHeight - margin) {
        newPage();
        if (!isHeader) drawRow(headers, true, false);
      }
      const rowTop = y;
      const rowBottom = rowTop + rowHeight;
      let x = margin;

      if (isHeader) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, rowTop, contentWidth, rowHeight, "F");
      }
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.55);
      doc.rect(margin, rowTop, contentWidth, rowHeight, "S");
      for (let index = 0; index < cells.length; index += 1) {
        if (index > 0) doc.line(x, rowTop, x, rowBottom);
        doc.setFont("helvetica", isHeader || isBold ? "bold" : "normal");
        doc.setFontSize(isHeader ? 8.5 : 9);
        doc.setTextColor(isHeader ? 15 : 51, isHeader ? 23 : 65, isHeader ? 42 : 85);
        doc.text(cellLines[index], x + rowPadding, rowTop + rowPadding + lineHeight - 2);
        x += widths[index];
      }
      y = rowBottom;
    }

    drawRow(headers, true, false);
    rows.forEach((row, index) => drawRow(row, false, boldLastRow && index === rows.length - 1));
    y += 18;
  }

  const campusRows = [
    ["Colleges represented", String(data.campus.collegesCovered)],
    ["Counsellors and Heads included", String(data.campus.staffCount)],
    ["Individual counselling sessions", String(data.campus.individualSessions)],
    ["Follow-up sessions", String(data.campus.followUpSessions)],
    ["Crisis SOS cases", String(data.campus.crisisSosCases)],
    ["Total sessions (including SOS)", String(data.campus.totalSessions)],
    ["Events and programs", String(data.campus.eventsAndPrograms)],
    ["Group sessions", String(data.campus.groupSessions)],
    ...extraStats.filter((stat) => stat.label.trim()).map((stat) => [stat.label.trim(), stat.value.trim()]),
  ];
  drawTable("1. Campus-wide sessions and activity", ["Activity", header.monthLabel], campusRows, [0.72, 0.28]);

  const staffRows = data.staffRows.map((row) => [
    row.collegeName,
    row.name,
    row.role === "head" ? "Head" : "Counsellor",
    String(row.individualSessions),
    String(row.followUpSessions),
    String(row.crisisSosCases),
    String(row.totalSessions),
    String(row.eventsAndPrograms),
    String(row.groupSessions),
  ]);
  staffRows.push([
    "",
    "Campus total",
    "",
    String(data.campus.individualSessions),
    String(data.campus.followUpSessions),
    String(data.campus.crisisSosCases),
    String(data.campus.totalSessions),
    String(data.campus.eventsAndPrograms),
    String(data.campus.groupSessions),
  ]);
  drawTable(
    "2. College and staff-wise activity",
    ["College", "Counsellor / Head", "Role", "Individual", "Follow-up", "SOS", "Total sessions", "Events / programs", "Groups"],
    staffRows,
    [0.16, 0.17, 0.08, 0.1, 0.09, 0.06, 0.1, 0.13, 0.11],
    true,
  );

  let sectionNumber = 3;
  for (const section of sections) {
    if (!section.heading.trim() && section.items.every((item) => !item.details.trim())) continue;
    ensureSpace(40);
    doc.setTextColor(15, 23, 42).setFont("helvetica", "bold").setFontSize(12);
    doc.text(`${sectionNumber}. ${section.heading || "Untitled Section"}`, margin, y);
    sectionNumber += 1;
    y += 18;
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(51, 65, 85);
    for (const item of section.items) {
      if (!item.details.trim() && !item.title.trim()) continue;
      const text = item.title.trim() ? `${item.title.trim()}: ${item.details.trim()}` : item.details.trim();
      const lines = wrapText(doc, `•  ${text}`, contentWidth);
      const height = lines.length * 13 + 6;
      ensureSpace(height);
      doc.text(lines, margin, y);
      y += height;
    }
    y += 10;
  }

  for (const file of photos) {
    const imageData = await fileToDataUrl(file);
    newPage();
    const image = doc.getImageProperties(imageData);
    const scale = Math.min(contentWidth / image.width, (pageHeight - margin * 2) / image.height, 1);
    doc.addImage(imageData, image.fileType, margin, margin, image.width * scale, image.height * scale);
  }

  return doc.output("blob");
}
