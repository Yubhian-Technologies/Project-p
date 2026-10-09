// A flexible, user-authored block for the narrative parts of a Monthly/
// Consolidated Report (Meetings & Administrative Activities, Summary of
// Activities, Goals, Priorities, etc.) — the counsellor/head types these in
// themselves each time; nothing here is auto-generated.
export interface ReportSectionItem {
  title: string;
  details: string;
}

export interface ReportSection {
  heading: string;
  items: ReportSectionItem[];
}

// A simple label/value row for Consolidated Report Executive Summary
// figures the app doesn't track anywhere (Digital Detox participants,
// MINDTAP episodes, Faculty Training status, etc.).
export interface ReportStatRow {
  label: string;
  value: string;
}
