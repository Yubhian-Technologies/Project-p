import { jsPDF } from "jspdf";
import type { ReportSection } from "../types/report";
import type { CampusMonthlyAnalytics, MonthlySessionData } from "./monthlyReportData";
import { createMonthlyReportPhotoRows, loadMonthlyReportLogo } from "./monthlyReportImages";

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
  campusAnalytics?: CampusMonthlyAnalytics;
}

function fileToDataUrl(file: Blob): Promise<string> {
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

export async function generateMonthlyReportPdf(input: MonthlyReportInput): Promise<Blob> {
  const { header, sections, goals, sessionData, photos, campusAnalytics } = input;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  let y = 56;

  const logo = await loadMonthlyReportLogo();
  const logoDataUrl = await fileToDataUrl(logo);
  const logoWidth = 90;
  const logoHeight = logoWidth * (379 / 447);
  doc.addImage(logoDataUrl, "JPEG", (pageWidth - logoWidth) / 2, 30, logoWidth, logoHeight);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.6);
  doc.line(margin, 118, pageWidth - margin, 118);
  y = 142;

  function ensureSpace(needed: number) {
    if (y + needed > pageHeight - 40) {
      doc.addPage();
      y = 50;
    }
  }

  doc.setFontSize(18).setFont("helvetica", "bold").text(
    `MONTHLY REPORT – ${header.monthLabel}`,
    margin,
    y,
  );
  y += 26;
  if (campusAnalytics) {
    ensureSpace(210);
    doc.setFontSize(13).setFont("helvetica", "bold").text("Sessions and Activity", margin, y);
    const rows: [string, number][] = [
      ["Individual counselling sessions", campusAnalytics.individualSessions],
      ["Follow-up sessions", campusAnalytics.followUpSessions],
      ["Crisis SOS cases", campusAnalytics.crisisSosCases],
      ["Events & programs", campusAnalytics.eventsAndPrograms],
      ["Group sessions", campusAnalytics.groupSessions],
      ["Total sessions (including SOS)", campusAnalytics.totalSessions],
    ];
    const tableX = margin;
    const tableY = y + 10;
    const tableWidth = contentWidth;
    const labelColumnWidth = tableWidth * 0.8;
    const rowHeight = 24;
    const tableHeight = rowHeight * (rows.length + 1);

    doc.setFillColor(248, 250, 252);
    doc.rect(tableX, tableY, tableWidth, rowHeight, "F");
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.6);
    doc.rect(tableX, tableY, tableWidth, tableHeight, "S");
    doc.line(tableX + labelColumnWidth, tableY, tableX + labelColumnWidth, tableY + tableHeight);
    for (let rowIndex = 1; rowIndex <= rows.length; rowIndex += 1) {
      doc.line(tableX, tableY + rowHeight * rowIndex, tableX + tableWidth, tableY + rowHeight * rowIndex);
    }

    doc.setFontSize(10.5).setFont("helvetica", "bold");
    doc.text("Activity", tableX + 8, tableY + 16);
    doc.text("Count", tableX + labelColumnWidth + 8, tableY + 16);
    for (const [rowIndex, [label, value]] of rows.entries()) {
      const rowY = tableY + rowHeight * (rowIndex + 1) + 16;
      doc.setFont("helvetica", label.startsWith("Total") ? "bold" : "normal");
      doc.text(label, tableX + 8, rowY);
      doc.text(String(value), tableX + labelColumnWidth + 8, rowY);
    }
    y = tableY + tableHeight + 18;
  }

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

  if (!campusAnalytics) {
    ensureSpace(70 + sessionData.weeks.length * 24);
    doc.setFontSize(13).setFont("helvetica", "bold").text("Sessions and Activity", margin, y);
    const rows: [string, string][] = [
      ...sessionData.weeks.map((week) => [`${week.dateRangeLabel} (${week.label})`, String(week.sessions)] as [string, string]),
      ["Total", String(sessionData.total)],
    ];
    const tableX = margin;
    const tableY = y + 10;
    const tableWidth = contentWidth;
    const labelColumnWidth = tableWidth * 0.8;
    const rowHeight = 24;
    const tableHeight = rowHeight * (rows.length + 1);

    doc.setFillColor(248, 250, 252);
    doc.rect(tableX, tableY, tableWidth, rowHeight, "F");
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.6);
    doc.rect(tableX, tableY, tableWidth, tableHeight, "S");
    doc.line(tableX + labelColumnWidth, tableY, tableX + labelColumnWidth, tableY + tableHeight);
    for (let rowIndex = 1; rowIndex <= rows.length; rowIndex += 1) {
      doc.line(tableX, tableY + rowHeight * rowIndex, tableX + tableWidth, tableY + rowHeight * rowIndex);
    }

    doc.setFontSize(10.5).setFont("helvetica", "bold");
    doc.text("Week", tableX + 8, tableY + 16);
    doc.text("Number of Sessions", tableX + labelColumnWidth + 8, tableY + 16);
    for (const [rowIndex, [label, value]] of rows.entries()) {
      const rowY = tableY + rowHeight * (rowIndex + 1) + 16;
      doc.setFont("helvetica", rowIndex === rows.length - 1 ? "bold" : "normal");
      doc.text(label, tableX + 8, rowY);
      doc.text(value, tableX + labelColumnWidth + 8, rowY);
    }
    y = tableY + tableHeight + 18;
  }

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

  ensureSpace(campusAnalytics ? 60 : 70);
  doc.setFontSize(11).setFont("helvetica", "normal");
  if (campusAnalytics) {
    doc.text(`Prepared by: ${header.preparedByName}`, margin, y);
    y += 16;
    doc.text("Department: Vishnu Wellness Centre", margin, y);
    y += 16;
    doc.text(`Campus: ${header.institutionName}`, margin, y);
  } else {
    doc.text(`Prepared by: ${header.preparedByName}`, margin, y);
    y += 16;
    doc.text("Department: Vishnu Wellness Centre", margin, y);
    y += 16;
    doc.text(`Role: ${header.roleTitle || "Wellness Counsellor"}`, margin, y);
    y += 16;
    doc.text(`Institution: ${header.institutionName}`, margin, y);
  }

  if (photos.length > 0) {
    const photoRows = await createMonthlyReportPhotoRows(photos);
    const rowGap = 18;
    const rowHeight = (pageHeight - margin * 2 - rowGap) / 2;

    for (let pageStart = 0; pageStart < photoRows.length; pageStart += 2) {
      doc.addPage();
      const rowsOnPage = photoRows.slice(pageStart, pageStart + 2);

      for (const [rowIndex, row] of rowsOnPage.entries()) {
        const rowY = margin + rowIndex * (rowHeight + rowGap);
        const isPairedPortrait = row.orientation === "portrait" && row.photos.length === 2;
        const tileWidth = isPairedPortrait ? (contentWidth - rowGap) / 2 : contentWidth;
        const startX = isPairedPortrait ? margin : row.orientation === "portrait"
          ? margin + (contentWidth - tileWidth) / 2
          : margin;

        for (const [photoIndex, photo] of row.photos.entries()) {
          const dataUrl = await fileToDataUrl(photo.file);
          const imgProps = doc.getImageProperties(dataUrl);
          const boxX = startX + (isPairedPortrait ? photoIndex * (tileWidth + rowGap) : 0);
          const scale = Math.min(tileWidth / imgProps.width, rowHeight / imgProps.height, 1);
          const imageWidth = imgProps.width * scale;
          const imageHeight = imgProps.height * scale;
          doc.addImage(
            dataUrl,
            imgProps.fileType,
            boxX + (tileWidth - imageWidth) / 2,
            rowY + (rowHeight - imageHeight) / 2,
            imageWidth,
            imageHeight,
          );
        }
      }
    }
  }

  return doc.output("blob");
}
