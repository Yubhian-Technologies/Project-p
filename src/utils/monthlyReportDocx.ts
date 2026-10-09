import { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, ImageRun, TextRun } from "docx";
import type { MonthlyReportInput } from "./monthlyReportPdf";

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

export async function generateMonthlyReportDocx(input: MonthlyReportInput): Promise<void> {
  const { header, sections, goals, sessionData, photos } = input;

  const photoImageRuns = await Promise.all(
    photos.map(async (file) => {
      const buf = await file.arrayBuffer();
      return new ImageRun({ data: buf, transformation: { width: 500, height: 375 }, type: inferImageType(file) });
    }),
  );

  const sectionParagraphs = sections.flatMap((section) => {
    if (!section.heading.trim() && section.items.every((it) => !it.details.trim())) return [];
    return [
      new Paragraph({ text: section.heading || "Untitled Section", heading: HeadingLevel.HEADING_2 }),
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

  const goalParagraphs =
    goals.filter((g) => g.trim()).length > 0
      ? [
          new Paragraph({ text: `Goals for the Upcoming Month – ${header.nextMonthLabel}`, heading: HeadingLevel.HEADING_2 }),
          ...goals.filter((g) => g.trim()).map((g, i) => new Paragraph(`${i + 1}. ${g.trim()}`)),
        ]
      : [];

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: `MONTHLY REPORT – ${header.monthLabel}`, heading: HeadingLevel.HEADING_1 }),
          new Paragraph(`In-Charge Psychologist: ${header.preparedByName}`),
          new Paragraph("Department: Vishnu Wellness Centre"),
          new Paragraph(`Institution: ${header.institutionName}`),
          new Paragraph(""),
          ...sectionParagraphs,
          new Paragraph({ text: `Counselling Sessions – ${header.monthLabel}`, heading: HeadingLevel.HEADING_2 }),
          tableFrom(
            [header.monthLabel, "Number of Sessions"],
            [
              ...sessionData.weeks.map((w) => [`${w.dateRangeLabel} (${w.label})`, String(w.sessions)]),
              ["Total", String(sessionData.total)],
            ],
          ),
          new Paragraph(""),
          ...goalParagraphs,
          new Paragraph(""),
          new Paragraph("Prepared by:"),
          new Paragraph({ children: [new TextRun({ text: header.preparedByName, bold: true })] }),
          new Paragraph({ children: [new TextRun({ text: header.roleTitle || "Wellness Counsellor", italics: true })] }),
          new Paragraph("Vishnu Wellness Centre"),
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
  link.download = `monthly-report-${header.monthLabel.replace(/\s/g, "-")}.docx`;
  link.click();
  URL.revokeObjectURL(link.href);
}
