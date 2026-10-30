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
  /** How the check-in was recorded. Legacy records (before camera flow)
      have no method — treated as "button". */
  checkInMethod?: "camera" | "manual" | "button";
  /** How the check-out was recorded. */
  checkOutMethod?: "camera" | "manual" | "button";
  /** Camera-location id the check-in was accepted at (camera method only). */
  checkInLocationId?: string;
  /** Camera-location name snapshot for display without extra reads. */
  checkInLocationName?: string;
  /** Camera-location id the check-out was accepted at. */
  checkOutLocationId?: string;
  /** Camera-location name snapshot. */
  checkOutLocationName?: string;
  /** Storage path of the check-in face capture. */
  checkInPhotoPath?: string;
  /** Storage path of the check-out face capture. */
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
