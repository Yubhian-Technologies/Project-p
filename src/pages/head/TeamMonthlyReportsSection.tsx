import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useAcademicYear } from "../../hooks/useAcademicYear";
import {
  listMonthlyStaffReportsForRecipient,
  verifyCounsellorMonthlyReport,
  type MonthlyStaffReport,
} from "../../services/firebase/counsellorMonthlyReports";
import { ReportList } from "../../components/reports/ReportList";
import "./MonthlyReportsSection.css";

/** Monthly reports shared within the Head's assigned college. */
export function TeamMonthlyReportsSection() {
  const { profile } = useAuth();
  const { includesMonth } = useAcademicYear();
  const campusId = profile?.campusId ?? "";
  const collegeId = profile?.collegeId ?? "";

  const [reports, setReports] = useState<MonthlyStaffReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  async function loadReports() {
    if (!campusId || !collegeId || !profile?.uid) { setLoading(false); return; }
    setLoading(true);
    try {
      setReports(await listMonthlyStaffReportsForRecipient(profile.uid, [{ campusId, collegeId }]));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campusId, collegeId, profile?.uid]);

  async function handleVerify(report: MonthlyStaffReport) {
    setVerifyingId(report.id);
    try {
      await verifyCounsellorMonthlyReport(report.id, profile?.displayName || profile?.email || "Head", profile?.uid ?? "", "");
      await loadReports();
    } finally {
      setVerifyingId(null);
    }
  }

  if (!campusId || !collegeId) {
    return <p style={{ color: "var(--neu-text-muted)", fontSize: 14 }}>Your profile isn't linked to a campus and college yet.</p>;
  }

  return (
    <div className="mr-section">
      <ReportList
        title="Monthly reports shared with you by your college team"
        reports={reports.filter(
          (r) =>
            r.uploadedByUid !== profile?.uid &&
            includesMonth(r.year, r.month, r.campusId || campusId, r.collegeId),
        )}
        loading={loading}
        emptyMessage="No monthly reports have been shared with you for your college yet."
        onRefresh={loadReports}
        onVerify={handleVerify}
        verifyingId={verifyingId}
      />
    </div>
  );
}
