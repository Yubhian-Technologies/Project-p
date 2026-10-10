import type { UserProfile } from "../types/user";
import type { Booking } from "../types/booking";

export type LiveStatus = "available" | "unavailable" | "in-session";

export function computeLiveStatus(profile: UserProfile, scheduledBookings: Booking[]): LiveStatus {
  const now = Date.now();
  const inSession = scheduledBookings.some(
    (b) =>
      b.counsellorId === profile.uid &&
      b.scheduledAt !== undefined &&
      now >= b.scheduledAt &&
      now < b.scheduledAt + b.durationMinutes * 60000,
  );
  if (inSession) return "in-session";
  return profile.available === false ? "unavailable" : "available";
}

export function liveStatusLabel(status: LiveStatus): string {
  switch (status) {
    case "available":
      return "Available";
    case "unavailable":
      return "Leave";
    case "in-session":
      return "In Session";
  }
}
