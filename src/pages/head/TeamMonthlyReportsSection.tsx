import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  listCounsellorMonthlyReportsForCampus,
  verifyCounsellorMonthlyReport,
  type CounsellorMonthlyReport,
} from "../../services/firebase/counsellorMonthlyReports";
import { ReportList } from "../../components/reports/ReportList";
import "./MonthlyReportsSection.css";

/** The monthly reports every counsellor across the Head's whole campus has
    submitted — reviewed and verified here, separate from the Head's own
    Consolidated Report (sent up to Admin). */
export function TeamMonthlyReportsSection() {
  const { profile } = useAuth();
  const campusId = profile?.campusId ?? "";

  const [reports, setReports] = useState<CounsellorMonthlyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  async function loadReports() {
    if (!campusId) { setLoading(false); return; }
    setLoading(true);
    try {
      setReports(await listCounsellorMonthlyReportsForCampus(campusId));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campusId]);

  async function handleVerify(report: CounsellorMonthlyReport) {
    setVerifyingId(report.id);
    try {
      await verifyCounsellorMonthlyReport(report.id, profile?.displayName || profile?.email || "Head", profile?.uid ?? "", "");
      await loadReports();
    } finally {
      setVerifyingId(null);
    }
  }

  if (!campusId) {
    return <p style={{ color: "var(--neu-text-muted)", fontSize: 14 }}>Your profile isn't linked to a campus yet.</p>;
  }

  return (
    <div className="mr-section">
      <ReportList
        title="Reports from your campus's counsellors"
        reports={reports}
        loading={loading}
        emptyMessage="No counsellor has submitted a monthly report yet."
        onRefresh={loadReports}
        onVerify={handleVerify}
        verifyingId={verifyingId}
      />
    </div>
  );
}
