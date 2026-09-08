import type { DayAvailability } from "../types/availability";

function formatTime(time: string): string {
  const [hourStr, minuteStr] = time.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
}

export function formatAvailabilitySchedule(schedule: DayAvailability[]): string[] {
  const enabledDays = schedule.filter((d) => d.enabled && d.start && d.end);
  if (enabledDays.length === 0) return [];

  const lines: string[] = [];
  let groupStart = enabledDays[0];
  let groupEnd = enabledDays[0];

  function flush() {
    const range =
      groupStart.day === groupEnd.day ? groupStart.day : `${groupStart.day} – ${groupEnd.day}`;
    lines.push(`${range}, ${formatTime(groupStart.start!)} – ${formatTime(groupStart.end!)}`);
  }

  for (let i = 1; i < enabledDays.length; i++) {
    const current = enabledDays[i];
    const sameHours = current.start === groupStart.start && current.end === groupStart.end;
    const consecutive = schedule.indexOf(current) === schedule.indexOf(groupEnd) + 1;
    if (sameHours && consecutive) {
      groupEnd = current;
    } else {
      flush();
      groupStart = current;
      groupEnd = current;
    }
  }
  flush();

  return lines;
}
