function csvCell(value: string | number): string {
  const str = String(value);
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/** Downloads a CSV file built from a flat list of rows — no forced header
 *  row, so callers that need meta lines (e.g. "Academic Year: 2026-2027")
 *  above the real table header can just include them as rows themselves. */
export function downloadCsvRows(filename: string, rows: (string | number)[][]): void {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Downloads a CSV file built from headers and rows — no external library needed. */
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  downloadCsvRows(filename, [headers, ...rows]);
}
