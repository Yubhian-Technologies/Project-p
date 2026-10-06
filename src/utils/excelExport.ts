export interface SheetMerge {
  s: { r: number; c: number };
  e: { r: number; c: number };
}

/**
 * Downloads a real .xlsx workbook (not CSV) — lets a sheet mix banner rows
 * (merged across the full width) with a proper data table underneath, which
 * a flat CSV can't represent cleanly: every row there is forced into the
 * same column shape, so a two-cell "Academic Year, 2026-2027" line next to a
 * four-column table below it just looks like stray, disconnected text when
 * opened in Excel.
 */
export async function downloadXlsx(
  filename: string,
  sheetName: string,
  rows: (string | number)[][],
  options?: { merges?: SheetMerge[]; colWidths?: number[] },
): Promise<void> {
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  if (options?.merges?.length) sheet["!merges"] = options.merges;
  if (options?.colWidths?.length) sheet["!cols"] = options.colWidths.map((wch) => ({ wch }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
