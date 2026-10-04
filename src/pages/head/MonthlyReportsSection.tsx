import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  listMonthlyReportsByCampus,
  uploadMonthlyReport,
  deleteMonthlyReport,
  type MonthlyReport,
} from "../../services/firebase/monthlyReports";
import { ReportUploadForm } from "../../components/reports/ReportUploadForm";
import { ReportList } from "../../components/reports/ReportList";
import "./MonthlyReportsSection.css";

/** The Head's Consolidated Reports workspace — there is exactly one Head per
    campus, overseeing every college in it: compile and submit one
    consolidated report to Admin. (Reviewing counsellors' own monthly reports
    lives in its own "Monthly Reports" tab.) */
export function MonthlyReportsSection() {
  const { profile } = useAuth();
  const campusId = profile?.campusId ?? "";
  const collegeId = profile?.collegeId ?? "";

  const [ownReports, setOwnReports] = useState<MonthlyReport[]>([]);
  const [loadingOwnReports, setLoadingOwnReports] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadOwnReports() {
    if (!campusId) { setLoadingOwnReports(false); return; }
    setLoadingOwnReports(true);
    try {
      setOwnReports(await listMonthlyReportsByCampus(campusId));
    } finally {
      setLoadingOwnReports(false);
    }
  }

  useEffect(() => {
    loadOwnReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campusId, collegeId]);

  async function handleDelete(report: MonthlyReport) {
    if (!window.confirm(`Delete "${report.title}"? This cannot be undone.`)) return;
    setDeletingId(report.id);
    try {
      await deleteMonthlyReport(report.id, report.storagePath);
      await loadOwnReports();
    } finally {
      setDeletingId(null);
    }
  }

  if (!campusId || !collegeId) {
    return <p style={{ color: "var(--neu-text-muted)", fontSize: 14 }}>Your profile isn't linked to a campus/college yet.</p>;
  }

  return (
    <div className="mr-section">
      <ReportUploadForm
        heading="Submit Consolidated Report to Admin"
        titlePlaceholder="e.g. September 2026 Consolidated Report"
        submitLabel="Submit Consolidated Report"
        allowVoiceInput={false}
        onUpload={async (file, title, month, year, onProgress) => {
          await uploadMonthlyReport(
            file,
            title,
            month,
            year,
            profile?.displayName || profile?.email || "Head",
            profile?.uid ?? "",
            onProgress,
            campusId,
            collegeId,
          );
          await loadOwnReports();
        }}
      />

      <ReportList
        title="Your Consolidated Reports"
        reports={ownReports}
        loading={loadingOwnReports}
        emptyMessage="You haven't submitted a consolidated report yet."
        showUploader={false}
        onRefresh={loadOwnReports}
        onDelete={handleDelete}
        deletingId={deletingId}
      />
    </div>
  );
}
