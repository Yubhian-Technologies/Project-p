import {
  AlignmentType,
  Document,
  HeadingLevel,
  ImageRun,
  PageOrientation,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
} from "docx";
import type { ConsolidatedReportInput } from "./consolidatedReportPdf";
import { loadMonthlyReportLogo } from "./monthlyReportImages";

function inferImageType(file: File): "jpg" | "png" | "gif" | "bmp" {
  if (file.type.includes("png")) return "png";
  if (file.type.includes("gif")) return "gif";
  if (file.type.includes("bmp")) return "bmp";
  return "jpg";
}

function tableFrom(headers: string[], rows: string[][]): Table {
  const headerRow = new TableRow({
    children: headers.map(
      (text) =>
        new TableCell({
          shading: { fill: "F8FAFC", type: ShadingType.CLEAR },
          children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })],
        }),
    ),
  });
  const dataRows = rows.map(
    (row, rowIndex) =>
      new TableRow({
        children: row.map(
          (text) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text,
                      bold: rowIndex === rows.length - 1 && row[1] === "Campus total",
                    }),
                  ],
                }),
              ],
            }),
        ),
      }),
  );
  return new Table({ rows: [headerRow, ...dataRows] });
}

export async function generateConsolidatedReportDocx(input: ConsolidatedReportInput): Promise<Blob> {
  const { header, extraStats, sections, data, photos } = input;
  const logo = await loadMonthlyReportLogo();
  const logoParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new ImageRun({
        data: await logo.arrayBuffer(),
        transformation: { width: 76, height: 65 },
        type: "jpg",
      }),
    ],
  });

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

  const staffRows = [
    ...data.staffRows.map((row) => [
      row.collegeName,
      row.name,
      row.role === "head" ? "Head" : "Counsellor",
      String(row.individualSessions),
      String(row.followUpSessions),
      String(row.crisisSosCases),
      String(row.totalSessions),
      String(row.eventsAndPrograms),
      String(row.groupSessions),
    ]),
    [
      "",
      "Campus total",
      "",
      String(data.campus.individualSessions),
      String(data.campus.followUpSessions),
      String(data.campus.crisisSosCases),
      String(data.campus.totalSessions),
      String(data.campus.eventsAndPrograms),
      String(data.campus.groupSessions),
    ],
  ];

  let sectionNumber = 3;
  const sectionParagraphs = sections.flatMap((section) => {
    if (!section.heading.trim() && section.items.every((item) => !item.details.trim())) return [];
    const heading = `${sectionNumber}. ${section.heading || "Untitled Section"}`;
    sectionNumber += 1;
    return [
      new Paragraph({ text: heading, heading: HeadingLevel.HEADING_2 }),
      ...section.items
        .filter((item) => item.details.trim() || item.title.trim())
        .map(
          (item) =>
            new Paragraph({
              bullet: { level: 0 },
              children: item.title.trim()
                ? [new TextRun({ text: `${item.title.trim()}: `, bold: true }), new TextRun(item.details.trim())]
                : [new TextRun(item.details.trim())],
            }),
        ),
    ];
  });

  const photoParagraphs = await Promise.all(
    photos.map(async (file) => {
      const buffer = await file.arrayBuffer();
      return new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            data: buffer,
            transformation: { width: 500, height: 375 },
            type: inferImageType(file),
          }),
        ],
      });
    }),
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: { size: { orientation: PageOrientation.LANDSCAPE } },
        },
        children: [
          logoParagraph,
          new Paragraph({
            alignment: AlignmentType.CENTER,
            text: "VISHNU WELLNESS CENTRE",
            heading: HeadingLevel.HEADING_2,
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            text: `CONSOLIDATED MONTHLY REPORT — ${header.monthLabel}`,
            heading: HeadingLevel.HEADING_2,
          }),
          new Paragraph({ alignment: AlignmentType.CENTER, text: data.campusName }),
          new Paragraph(""),
          new Paragraph({ text: "1. Campus-wide sessions and activity", heading: HeadingLevel.HEADING_2 }),
          tableFrom(["Activity", header.monthLabel], campusRows),
          new Paragraph(""),
          new Paragraph({ text: "2. College and staff-wise activity", heading: HeadingLevel.HEADING_2 }),
          tableFrom(
            ["College", "Counsellor / Head", "Role", "Individual", "Follow-up", "SOS", "Total sessions", "Events / programs", "Groups"],
            staffRows,
          ),
          new Paragraph(""),
          ...sectionParagraphs,
          ...(photoParagraphs.length > 0
            ? [new Paragraph({ text: "Photos", heading: HeadingLevel.HEADING_2 }), ...photoParagraphs]
            : []),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}
