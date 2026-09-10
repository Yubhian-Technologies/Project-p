export interface CalendarMonth {
  id: string;
  campusId: string;
  collegeId: string;
  yearId: string;
  month: number; // 0-11
  calendarYear: number;
  createdBy: string;
  createdAt: number;
}
