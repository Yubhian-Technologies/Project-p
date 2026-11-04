export interface AttendanceRecord {
  id: string;
  uid: string;
  campusId: string;
  /** IST calendar day the record belongs to, YYYY-MM-DD. */
  date: string;
  /** Epoch ms of the check-in. Set once, when the day's record is created. */
  checkInAt?: number;
  /** Epoch ms of the check-out. Added once the user checks out. */
  checkOutAt?: number;
  /** How the check-in was recorded. Older button records may have no method. */
  checkInMethod?: "camera" | "manual" | "button";
  /** How the check-out was recorded. */
  checkOutMethod?: "camera" | "manual" | "button";
  /** Assigned-location id the check-in was accepted at. */
  checkInLocationId?: string;
  /** Camera-location name snapshot for display without extra reads. */
  checkInLocationName?: string;
  /** Camera-location id the check-out was accepted at. */
  checkOutLocationId?: string;
  /** Camera-location name snapshot. */
  checkOutLocationName?: string;
  /** Legacy storage path of the check-in camera capture. */
  checkInPhotoPath?: string;
  /** Legacy storage path of the check-out camera capture. */
  checkOutPhotoPath?: string;
  /** Set when a Head manually marks check-in/out on behalf of the person. */
  manualEntry?: {
    /** Which half was marked manually. */
    part: "check-in" | "check-out" | "both";
    /** Mandatory reason the Head must type. */
    reason: string;
    markedByUid: string;
    markedByName: string;
    markedAt: number;
  };
  updatedAt?: number;
}
