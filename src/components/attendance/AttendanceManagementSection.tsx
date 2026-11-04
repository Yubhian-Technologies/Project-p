import { useState } from "react";
import { TeamAttendanceSection } from "./TeamAttendanceSection";
import { CameraLocationsSection } from "./CameraLocationsSection";
import "./AttendanceManagementSection.css";

type Tab = "check-in-out" | "locations";

const TABS: { id: Tab; label: string }[] = [
  { id: "check-in-out", label: "Check-in / Check-out" },
  { id: "locations", label: "Check-in Locations" },
];

/** The full Attendance tab shared by Head, Admin, and Super Admin dashboards. */
export function AttendanceManagementSection() {
  const [activeTab, setActiveTab] = useState<Tab>("check-in-out");

  return (
    <div className="attendance-management">
      <div className="attendance-management__tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`attendance-management__tab${activeTab === tab.id ? " attendance-management__tab--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "check-in-out" && <TeamAttendanceSection />}
      {activeTab === "locations" && <CameraLocationsSection />}
    </div>
  );
}
