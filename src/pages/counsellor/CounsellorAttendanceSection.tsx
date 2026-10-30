import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { listAttendance } from "../../services/firebase/attendance";
import type { AttendanceRecord } from "../../types/attendance";
import { Card } from "../../components/common/Card";
import { AttendanceCheckCard } from "../../components/attendance/AttendanceCheckCard";
import { MyAttendanceLog } from "../../components/attendance/MyAttendanceLog";
import { LeaveManagementSection } from "../../components/leaves/LeaveManagementSection";
import "./CounsellorAttendanceSection.css";

type Tab = "attendance" | "leaves";

/**
 * The Counsellor dashboard's full Attendance section: today's camera
 * check-in / check-out card, a this-month summary, a date-filtered personal
 * log, and Leave management — switched between via tabs rather than stacked
 * on one long page, so only one concern is ever on screen at a time.
 */
export function CounsellorAttendanceSection() {
  const { currentUser, profile } = useAuth();
  const uid = currentUser?.uid;
  const campusId = profile?.campusId;
  const [activeTab, setActiveTab] = useState<Tab>("attendance");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uid || !campusId) return;
    listAttendance(uid, campusId)
      .then((r) => setRecords(r))
      .catch(() => setError("Couldn't load your attendance log."));
  }, [uid, campusId]);

  const monthSummary = useMemo(() => {
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    let present = 0;
    let missingOut = 0;
    records.forEach((r) => {
      if (!r.date.startsWith(prefix)) return;
      if (r.checkInAt != null && r.checkOutAt != null) present += 1;
      else if (r.checkInAt != null) missingOut += 1;
    });
    return { present, missingOut };
  }, [records]);

  const TABS: { id: Tab; label: string }[] = [
    { id: "attendance", label: "Attendance" },
    { id: "leaves", label: "Leaves" },
  ];

  return (
    <div className="counsellor-attendance">
      <div className="counsellor-attendance__tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`counsellor-attendance__tab${activeTab === tab.id ? " counsellor-attendance__tab--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "attendance" && (
        <>
          <div className="bento-grid">
            <AttendanceCheckCard span={6} />
            <Card className="counsellor-attendance__summary">
              <p className="counsellor-attendance__summary-title">This month</p>
              <div className="counsellor-attendance__summary-stats">
                <span className="counsellor-attendance__pill counsellor-attendance__pill--present">
                  {monthSummary.present} present
                </span>
                {monthSummary.missingOut > 0 && (
                  <span className="counsellor-attendance__pill counsellor-attendance__pill--missing">
                    {monthSummary.missingOut} missing check-out
                  </span>
                )}
              </div>
              <p className="counsellor-attendance__hint">
                A day counts as Present only when it has both a check-in and a check-out.
              </p>
            </Card>
          </div>

          {error && <p className="counsellor-attendance__error">{error}</p>}

          <MyAttendanceLog />
        </>
      )}

      {activeTab === "leaves" && <LeaveManagementSection />}
    </div>
  );
}
