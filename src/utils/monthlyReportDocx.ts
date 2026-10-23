import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  PageBreak,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  ShadingType,
  TextRun,
} from "docx";
import type { MonthlyReportInput } from "./monthlyReportPdf";
import { createMonthlyReportPhotoRows, loadMonthlyReportLogo } from "./monthlyReportImages";

function inferImageType(file: File): "jpg" | "png" | "gif" | "bmp" {
  if (file.type.includes("png")) return "png";
  if (file.type.includes("gif")) return "gif";
  if (file.type.includes("bmp")) return "bmp";
  return "jpg";
}

function tableFrom(headers: string[], rows: string[][], subtleStyle = false): Table {
  const headerRow = new TableRow({
    children: headers.map(
      (h) => new TableCell({
        ...(subtleStyle ? { shading: { fill: "F8FAFC", type: ShadingType.CLEAR } } : {}),
        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
      }),
    ),
  });
  const dataRows = rows.map((row, rowIndex) =>
    new TableRow({
      children: row.map((cell) =>
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: cell, bold: subtleStyle && rowIndex === rows.length - 1 })],
            }),
          ],
        }),
      ),
    }),
  );
  return new Table({
    rows: [headerRow, ...dataRows],
    ...(subtleStyle
      ? {
          borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
            left: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
            right: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
            insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
          },
        }
      : {}),
  });
}

export async function generateMonthlyReportDocx(input: MonthlyReportInput): Promise<Blob> {
  const { header, sections, goals, sessionData, photos, campusAnalytics } = input;
  const photoRows = await createMonthlyReportPhotoRows(photos);
  const photoParagraphs: Paragraph[] = [];
  const maxPhotoHeight = 320;
  const fullPhotoWidth = 600;
  const portraitPhotoWidth = 290;

  for (let pageStart = 0; pageStart < photoRows.length; pageStart += 2) {
    photoParagraphs.push(new Paragraph({ children: [new PageBreak()] }));
    const rowsOnPage = photoRows.slice(pageStart, pageStart + 2);

    for (const row of rowsOnPage) {
      const maxWidth = row.orientation === "landscape" ? fullPhotoWidth : portraitPhotoWidth;
      const imageRuns = await Promise.all(
        row.photos.map(async (photo) => {
          const scale = Math.min(maxWidth / photo.width, maxPhotoHeight / photo.height, 1);
          const buf = await photo.file.arrayBuffer();
          return new ImageRun({
            data: buf,
            transformation: {
              width: photo.width * scale,
              height: photo.height * scale,
            },
            type: inferImageType(photo.file),
          });
        }),
      );
      const rowChildren = imageRuns.flatMap((run, index) =>
        index === 0 ? [run] : [new TextRun("   "), run],
      );
      photoParagraphs.push(new Paragraph({ alignment: AlignmentType.CENTER, children: rowChildren }));
    }
  }

  const logo = await loadMonthlyReportLogo();
  const logoParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new ImageRun({
        data: await logo.arrayBuffer(),
        transformation: { width: 90, height: 76 },
        type: "jpg",
      }),
    ],
  });

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

  const campusAnalyticsParagraphs = campusAnalytics
    ? [
        new Paragraph({ text: "Sessions and Activity", heading: HeadingLevel.HEADING_2 }),
        tableFrom(
          ["Activity", "Count"],
          [
            ["Individual counselling sessions", String(campusAnalytics.individualSessions)],
            ["Follow-up sessions", String(campusAnalytics.followUpSessions)],
            ["Crisis SOS cases", String(campusAnalytics.crisisSosCases)],
            ["Events & programs", String(campusAnalytics.eventsAndPrograms)],
            ["Group sessions", String(campusAnalytics.groupSessions)],
            ["Total sessions (including SOS)", String(campusAnalytics.totalSessions)],
          ],
          true,
        ),
        new Paragraph(""),
      ]
    : [];

  const monthlySessionParagraphs = campusAnalytics
    ? []
    : [
        new Paragraph({ text: "Sessions and Activity", heading: HeadingLevel.HEADING_2 }),
        tableFrom(
          ["Week", "Number of Sessions"],
          [
            ...sessionData.weeks.map((w) => [`${w.dateRangeLabel} (${w.label})`, String(w.sessions)]),
            ["Total", String(sessionData.total)],
          ],
          true,
        ),
        new Paragraph(""),
      ];

  const preparedByDetails = campusAnalytics
    ? [
        new Paragraph(`Prepared by: ${header.preparedByName}`),
        new Paragraph("Department: Vishnu Wellness Centre"),
        new Paragraph(`Campus: ${header.institutionName}`),
      ]
    : [
        new Paragraph(`Prepared by: ${header.preparedByName}`),
        new Paragraph("Department: Vishnu Wellness Centre"),
        new Paragraph(`Role: ${header.roleTitle || "Wellness Counsellor"}`),
        new Paragraph(`Institution: ${header.institutionName}`),
      ];

  const doc = new Document({
    sections: [
      {
        children: [
          logoParagraph,
          new Paragraph({
            border: {
              bottom: {
                style: BorderStyle.SINGLE,
                size: 4,
                color: "E2E8F0",
                space: 5,
              },
            },
            children: [new TextRun("")],
          }),
          new Paragraph({
            text: `MONTHLY REPORT – ${header.monthLabel}`,
            heading: HeadingLevel.HEADING_1,
          }),
          ...campusAnalyticsParagraphs,
          ...sectionParagraphs,
          ...monthlySessionParagraphs,
          ...goalParagraphs,
          new Paragraph(""),
          ...preparedByDetails,
          ...photoParagraphs,
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}
