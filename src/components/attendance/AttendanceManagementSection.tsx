import { useState } from "react";
import { TeamAttendanceSection } from "./TeamAttendanceSection";
import { FaceRegistrationsSection } from "./FaceRegistrationsSection";
import { CameraLocationsSection } from "./CameraLocationsSection";
import "./AttendanceManagementSection.css";

type Tab = "check-in-out" | "face-registrations" | "camera-locations";

const TABS: { id: Tab; label: string }[] = [
  { id: "check-in-out", label: "Check-in / Check-out" },
  { id: "face-registrations", label: "Face Registrations" },
  { id: "camera-locations", label: "Camera Locations" },
];

/** The full Attendance tab shared by Head, Admin, and Super Admin dashboards:
    who's checked in today, face registration status, and camera check-in
    location setup — switched between via tabs instead of stacked on one
    long page or split across separate sidebar entries. Each dashboard
    renders this single component; the scope (whose data shows up) is
    resolved per-viewer inside TeamAttendanceSection / FaceRegistrationsSection
    / CameraLocationsSection, matching that dashboard's existing hierarchy. */
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
      {activeTab === "face-registrations" && <FaceRegistrationsSection />}
      {activeTab === "camera-locations" && <CameraLocationsSection />}
    </div>
  );
}
