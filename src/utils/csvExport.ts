function csvCell(value: string | number): string {
  const str = String(value);
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/** Downloads a CSV file built from headers and rows — no external library needed. */
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const body = rows.map((row) => row.map(csvCell).join(","));
  const csv = [headers.map(csvCell).join(","), ...body].join("\r\n");
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
