import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useAcademicYear } from "../../hooks/useAcademicYear";
import {
  listMonthlyReportRecipients,
  listMonthlyStaffReportsForUser,
  submitMonthlyStaffReport,
  type MonthlyReportRecipient,
  type MonthlyStaffReport,
} from "../../services/firebase/counsellorMonthlyReports";
import { MonthlyReportDownload } from "../../components/reports/MonthlyReportDownload";
import { ReportUploadForm } from "../../components/reports/ReportUploadForm";
import { ReportList } from "../../components/reports/ReportList";
import "./CounsellorMonthlyReportsSection.css";

/** The counsellor's combined monthly report preparation, college recipient
    selection, submission history, and optional existing-file upload. */
export function CounsellorMonthlyReportsSection() {
  const { profile } = useAuth();
  const { includesMonth } = useAcademicYear();
  const campusId = profile?.campusId ?? "";
  const collegeId = profile?.collegeId ?? "";

  const [reports, setReports] = useState<MonthlyStaffReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [recipients, setRecipients] = useState<MonthlyReportRecipient[]>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(true);
  const [recipientsError, setRecipientsError] = useState("");
  const [reportsError, setReportsError] = useState("");

  async function loadReports() {
    if (!profile?.uid) { setLoading(false); return; }
    setLoading(true);
    try {
      setReports(await listMonthlyStaffReportsForUser(profile.uid));
      setReportsError("");
    } catch (err) {
      console.error("Failed to load counsellor monthly reports:", err);
      setReportsError("Could not load your report history. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.uid]);

  useEffect(() => {
    let active = true;
    if (!campusId || !collegeId) {
      setRecipients([]);
      setRecipientsLoading(false);
      return;
    }
    setRecipients([]);
    setRecipientsLoading(true);
    listMonthlyReportRecipients(campusId, collegeId, "counsellor")
      .then((items) => {
        if (active) {
          setRecipients(items);
          setRecipientsError("");
        }
      })
      .catch((err: unknown) => {
        console.error("Failed to load monthly report recipients:", err);
        if (active) {
          setRecipients([]);
          setRecipientsError("Could not load your college's report recipients.");
        }
      })
      .finally(() => {
        if (active) setRecipientsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [campusId, collegeId]);

  if (!campusId || !collegeId) {
    return (
      <p style={{ color: "var(--neu-text-muted)", fontSize: 14 }}>
        Your profile isn't linked to a campus/college yet, so reports can't be submitted.
      </p>
    );
  }

  return (
    <div className="cmr-section">
      <MonthlyReportDownload
        recipientOptions={recipients}
        recipientsLoading={recipientsLoading}
        onSubmitReport={async (file, title, month, year, recipientUids) => {
          await submitMonthlyStaffReport(
            file,
            title,
            month,
            year,
            profile?.displayName || profile?.email || "Counsellor",
            profile?.uid ?? "",
            "counsellor",
            campusId,
            collegeId,
            recipientUids,
          );
          await loadReports();
        }}
      />
      {recipientsError && <p role="alert" className="monthly-report-download__error">{recipientsError}</p>}

      <details className="cmr-existing-upload">
        <summary>Upload an existing report instead</summary>
        {recipientsLoading ? (
          <p>Loading recipients for your college…</p>
        ) : recipients.length === 0 ? (
          <p role="alert">No eligible Head, Principal, or Vice Principal is assigned to your college.</p>
        ) : (
          <>
            <p>This upload will notify the Head and Principal/Vice Principal accounts assigned to your college.</p>
            <ReportUploadForm
              heading="Submit an existing monthly report"
              titlePlaceholder="e.g. September 2026 Counselling Report"
              submitLabel="Submit Report"
              allowVoiceInput={false}
              onUpload={async (file, title, month, year, onProgress) => {
                await submitMonthlyStaffReport(
                  file,
                  title,
                  month,
                  year,
                  profile?.displayName || profile?.email || "Counsellor",
                  profile?.uid ?? "",
                  "counsellor",
                  campusId,
                  collegeId,
                  recipients.map((recipient) => recipient.uid),
                  onProgress,
                );
                await loadReports();
              }}
            />
          </>
        )}
      </details>

      <ReportList
        title="Your Submitted Reports"
        reports={reports.filter((report) => includesMonth(report.year, report.month, report.campusId || campusId, report.collegeId))}
        loading={loading}
        emptyMessage="You haven't submitted a monthly report yet."
        showUploader={false}
        onRefresh={loadReports}
      />
      {reportsError && <p role="alert" className="monthly-report-download__error">{reportsError}</p>}
    </div>
  );
}
