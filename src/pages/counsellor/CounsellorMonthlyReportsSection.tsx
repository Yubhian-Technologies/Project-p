import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  submitCounsellorMonthlyReport,
  listCounsellorMonthlyReportsForUser,
  type CounsellorMonthlyReport,
} from "../../services/firebase/counsellorMonthlyReports";
import { ReportUploadForm } from "../../components/reports/ReportUploadForm";
import { ReportList } from "../../components/reports/ReportList";
import "./CounsellorMonthlyReportsSection.css";

/** A counsellor submits their own monthly report here — it goes straight to
    (and is visible only to) the Head of their own college. */
export function CounsellorMonthlyReportsSection() {
  const { profile } = useAuth();
  const campusId = profile?.campusId ?? "";
  const collegeId = profile?.collegeId ?? "";

  const [reports, setReports] = useState<CounsellorMonthlyReport[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadReports() {
    if (!profile?.uid) { setLoading(false); return; }
    setLoading(true);
    try {
      setReports(await listCounsellorMonthlyReportsForUser(profile.uid));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.uid]);

  if (!campusId || !collegeId) {
    return (
      <p style={{ color: "var(--neu-text-muted)", fontSize: 14 }}>
        Your profile isn't linked to a campus/college yet, so reports can't be submitted.
      </p>
    );
  }

  return (
    <div className="cmr-section">
      <ReportUploadForm
        heading="Submit Monthly Report to your Head"
        titlePlaceholder="e.g. September 2026 Counselling Report"
        submitLabel="Submit Report"
        allowVoiceInput={false}
        onUpload={async (file, title, month, year, onProgress) => {
          await submitCounsellorMonthlyReport(
            file,
            title,
            month,
            year,
            profile?.displayName || profile?.email || "Counsellor",
            profile?.uid ?? "",
            campusId,
            collegeId,
            onProgress,
          );
          await loadReports();
        }}
      />

      <ReportList
        title="Your Submitted Reports"
        reports={reports}
        loading={loading}
        emptyMessage="You haven't submitted a monthly report yet."
        showUploader={false}
        onRefresh={loadReports}
      />
    </div>
  );
}
