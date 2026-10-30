/**
 * A camera check-in location assigned to ONE specific login (a counsellor or
 * head). Each person has at most two fixed slots — "location-1" and
 * "location-2" — managed by their campus Head, a Management admin, or the
 * Super Admin. Doc id: {uid}_{slot}, so the two-slot cap is structural.
 */
export type CameraSlot = "location-1" | "location-2";

export interface CameraLocation {
  id: string; // {uid}_{slot}
  /** The login (counsellor or head) this location belongs to. */
  uid: string;
  slot: CameraSlot;
  campusId: string;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  /** Accepted range around the coordinates, in meters. */
  radiusMeters: number;
  createdByUid: string;
  createdByName: string;
  createdByRole: string;
  createdAt: number;
  updatedAt?: number;
}
