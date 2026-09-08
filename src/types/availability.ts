export interface DayAvailability {
  day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
  enabled: boolean;
  start?: string;
  end?: string;
}

export const WEEK_DAYS: DayAvailability["day"][] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function defaultAvailabilitySchedule(): DayAvailability[] {
  return WEEK_DAYS.map((day) => ({ day, enabled: false }));
}
