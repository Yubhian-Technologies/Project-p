/** App-wide date display format: dd/mm/yy — e.g. "10/10/26". */
export function formatDateDMY(ms: number): string {
  const d = new Date(ms);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

/** Same dd/mm/yy date, plus a local time — e.g. "10/10/26, 2:30 PM". */
export function formatDateTimeDMY(ms: number): string {
  const timePart = new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${formatDateDMY(ms)}, ${timePart}`;
}

/** Same dd/mm/yy date, with the weekday name in front — e.g. "Sat, 10/10/26". */
export function formatWeekdayDateDMY(ms: number): string {
  const weekday = new Date(ms).toLocaleDateString(undefined, { weekday: "short" });
  return `${weekday}, ${formatDateDMY(ms)}`;
}
