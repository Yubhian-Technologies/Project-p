import { useState } from "react";
import { TeamAttendanceSection } from "./TeamAttendanceSection";
import { FaceRegistrationsSection } from "../../components/attendance/FaceRegistrationsSection";
import { CameraLocationsSection } from "../../components/attendance/CameraLocationsSection";
import "./HeadAttendanceSection.css";

type Tab = "check-in-out" | "face-registrations" | "camera-locations";

const TABS: { id: Tab; label: string }[] = [
  { id: "check-in-out", label: "Check-in / Check-out" },
  { id: "face-registrations", label: "Face Registrations" },
  { id: "camera-locations", label: "Camera Locations" },
];

/** The Head's full Attendance tab: who's checked in today, face
    registration status, and camera check-in location setup — switched
    between via tabs instead of stacked on one long page, matching the
    tabbed layout already used on the Counsellor's own Attendance page. */
export function HeadAttendanceSection() {
  const [activeTab, setActiveTab] = useState<Tab>("check-in-out");

  return (
    <div className="head-attendance">
      <div className="head-attendance__tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`head-attendance__tab${activeTab === tab.id ? " head-attendance__tab--active" : ""}`}
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
