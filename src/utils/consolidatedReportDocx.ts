import { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, ImageRun, TextRun } from "docx";
import type { ConsolidatedReportInput } from "./consolidatedReportPdf";

function inferImageType(file: File): "jpg" | "png" | "gif" | "bmp" {
  if (file.type.includes("png")) return "png";
  if (file.type.includes("gif")) return "gif";
  if (file.type.includes("bmp")) return "bmp";
  return "jpg";
}

function tableFrom(headers: string[], rows: string[][]): Table {
  const headerRow = new TableRow({
    children: headers.map(
      (h) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })] }),
    ),
  });
  const dataRows = rows.map(
    (r) => new TableRow({ children: r.map((cell) => new TableCell({ children: [new Paragraph(cell)] })) }),
  );
  return new Table({ rows: [headerRow, ...dataRows] });
}

export async function generateConsolidatedReportDocx(input: ConsolidatedReportInput): Promise<void> {
  const { header, extraStats, sections, data, photos } = input;

  const photoImageRuns = await Promise.all(
    photos.map(async (file) => {
      const buf = await file.arrayBuffer();
      return new ImageRun({ data: buf, transformation: { width: 500, height: 375 }, type: inferImageType(file) });
    }),
  );

  const execRows: string[][] = [
    ["Institutions Covered / Represented", String(data.institutionsCovered)],
    ["Individual Counselling Sessions Reported", String(data.totalSessions)],
    ["Student Group Sessions Reported", String(data.groupSessionsCount)],
    ...extraStats.filter((s) => s.label.trim()).map((s) => [s.label.trim(), s.value.trim()]),
  ];

  let sectionNumber = 3;
  const sectionParagraphs = sections.flatMap((section) => {
    if (!section.heading.trim() && section.items.every((it) => !it.details.trim())) return [];
    const heading = `${sectionNumber}. ${section.heading || "Untitled Section"}`;
    sectionNumber += 1;
    return [
      new Paragraph({ text: heading, heading: HeadingLevel.HEADING_2 }),
      ...section.items
        .filter((it) => it.details.trim() || it.title.trim())
        .map(
          (it) =>
            new Paragraph({
              bullet: { level: 0 },
              children: it.title.trim()
                ? [new TextRun({ text: `${it.title.trim()}: `, bold: true }), new TextRun(it.details.trim())]
                : [new TextRun(it.details.trim())],
            }),
        ),
    ];
  });

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: "SHRI VISHNU EDUCATIONAL SOCIETY", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: "VISHNU WELLNESS CENTRE", heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ text: `CONSOLIDATED MONTHLY REPORT – ${header.monthLabel}`, heading: HeadingLevel.HEADING_2 }),
          new Paragraph(""),
          new Paragraph({ text: "1. Executive Summary", heading: HeadingLevel.HEADING_2 }),
          tableFrom(["Particulars", header.monthLabel], execRows),
          new Paragraph(""),
          new Paragraph({ text: "2. Institution-wise Counselling Summary", heading: HeadingLevel.HEADING_2 }),
          tableFrom(
            ["Institution / Area", "Counsellor(s)", "Individual Sessions"],
            [
              ...data.institutions.map((row) => [row.collegeName, row.counsellorNames.join(", ") || "—", String(row.sessions)]),
              ["Total Reported Sessions", "", String(data.totalSessions)],
            ],
          ),
          new Paragraph(""),
          ...sectionParagraphs,
          ...(photoImageRuns.length > 0
            ? [new Paragraph({ text: "Photos", heading: HeadingLevel.HEADING_2 }), ...photoImageRuns.map((run) => new Paragraph({ children: [run] }))]
            : []),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `consolidated-report-${header.monthLabel.replace(/\s/g, "-")}.docx`;
  link.click();
  URL.revokeObjectURL(link.href);
}
