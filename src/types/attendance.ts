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
  updatedAt?: number;
}
