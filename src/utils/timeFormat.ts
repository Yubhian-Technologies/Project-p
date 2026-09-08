export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function to12Hour(hour24: number): { hour12: number; ampm: "AM" | "PM" } {
  const ampm: "AM" | "PM" = hour24 >= 12 ? "PM" : "AM";
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour12, ampm };
}

export function to24Hour(hour12: number, ampm: "AM" | "PM"): number {
  let hour = hour12 % 12;
  if (ampm === "PM") hour += 12;
  return hour;
}
