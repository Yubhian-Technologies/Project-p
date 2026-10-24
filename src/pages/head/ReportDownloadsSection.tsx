import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { MonthlyReportDownload } from "../../components/reports/MonthlyReportDownload";
import { ConsolidatedReportDownloadSection } from "./ConsolidatedReportDownloadSection";
import { ReportUploadForm } from "../../components/reports/ReportUploadForm";
import { ReportList } from "../../components/reports/ReportList";
import { Card } from "../../components/common/Card";
import { Select } from "../../components/common/Select";
import {
  listMonthlyStaffReportsForUser,
  listMonthlyReportRecipients,
  submitMonthlyStaffReport,
  type MonthlyStaffReport,
  type MonthlyReportRecipient,
} from "../../services/firebase/counsellorMonthlyReports";
import "../../components/reports/MonthlyReportDownload.css";
import "./MonthlyReportsSection.css";

export type ReportKind = "monthly" | "consolidated";

/** Combines the Head's two self-service report downloads (My Monthly Report,
    Consolidated Report) into one sidebar section, picked via a dropdown,
    instead of two separate sidebar entries. */
export function ReportDownloadsSection({ initialKind = "monthly" }: { initialKind?: ReportKind }) {
  const [kind, setKind] = useState<ReportKind>(initialKind);

  return (
    <div className="monthly-report-download">
      <Card className="monthly-report-download__kind-card">
        <div className="monthly-report-download__field">
          <label htmlFor="report-kind">Report type</label>
          <Select id="report-kind" value={kind} onChange={(v) => setKind(v as ReportKind)}>
            <option value="monthly">My Monthly Report</option>
            <option value="consolidated">Consolidated Report</option>
          </Select>
        </div>
      </Card>

      {kind === "monthly" ? <HeadMonthlyReportWorkspace /> : <ConsolidatedReportDownloadSection />}
    </div>
  );
}

function HeadMonthlyReportWorkspace() {
  const { profile } = useAuth();
  const campusId = profile?.campusId ?? "";
  const collegeId = profile?.collegeId ?? "";
  const [reports, setReports] = useState<MonthlyStaffReport[]>([]);
  const [recipients, setRecipients] = useState<MonthlyReportRecipient[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [loadingRecipients, setLoadingRecipients] = useState(true);
  const [recipientsError, setRecipientsError] = useState("");
  const [reportsError, setReportsError] = useState("");

  async function loadReports() {
    if (!profile?.uid) {
      setLoadingReports(false);
      return;
    }
    setLoadingReports(true);
    try {
      setReports(await listMonthlyStaffReportsForUser(profile.uid));
      setReportsError("");
    } catch (err) {
      console.error("Failed to load Head monthly reports:", err);
      setReportsError("Could not load your report history. Please try again.");
    } finally {
      setLoadingReports(false);
    }
  }

  useEffect(() => {
    void loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.uid]);

  useEffect(() => {
    let active = true;
    if (!campusId || !collegeId) {
      setRecipients([]);
      setLoadingRecipients(false);
      return;
    }
    setRecipients([]);
    setLoadingRecipients(true);
    listMonthlyReportRecipients(campusId, collegeId, "head")
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
          setRecipientsError("Could not load your college's Principal and Vice Principal.");
        }
      })
      .finally(() => {
        if (active) setLoadingRecipients(false);
      });
    return () => {
      active = false;
    };
  }, [campusId, collegeId]);

  async function submit(
    file: File,
    title: string,
    month: number,
    year: number,
    recipientUids: string[],
    onProgress?: (pct: number) => void,
  ) {
    if (!profile?.uid) throw new Error("Your profile is not available.");
    await submitMonthlyStaffReport(
      file,
      title,
      month,
      year,
      profile.displayName || profile.email || "Head",
      profile.uid,
      "head",
      campusId,
      collegeId,
      recipientUids,
      onProgress,
    );
    await loadReports();
  }

  if (!campusId || !collegeId) {
    return <p style={{ color: "var(--neu-text-muted)", fontSize: 14 }}>Your profile isn't linked to a campus and college yet.</p>;
  }

  return (
    <>
      <MonthlyReportDownload
        mode="head"
        recipientOptions={recipients}
        recipientsLoading={loadingRecipients}
        reportHistoryLoading={loadingReports}
        reportHistoryError={reportsError}
        isResharePeriod={(month, year) =>
          reports.some((report) => report.month === month && report.year === year)
        }
        onSubmitReport={(file, title, month, year, recipientUids) =>
          submit(file, title, month, year, recipientUids)
        }
      />
      {recipientsError && <p role="alert" className="monthly-report-download__error">{recipientsError}</p>}

      <details className="cmr-existing-upload">
        <summary>Upload an existing monthly report instead</summary>
        {loadingRecipients ? (
          <p>Loading recipients for your college…</p>
        ) : recipients.length === 0 ? (
          <p role="alert">No Principal or Vice Principal is assigned to your college.</p>
        ) : (
          <>
            <p>This upload will notify the Principal and Vice Principal accounts assigned to your college.</p>
            <ReportUploadForm
              heading="Submit an existing monthly report"
              titlePlaceholder="e.g. September 2026 Head's Report"
              submitLabel="Send Report"
              allowVoiceInput={false}
              submitDisabled={loadingReports || Boolean(reportsError)}
              isResharePeriod={(month, year) =>
                reports.some((report) => report.month === month && report.year === year)
              }
              onUpload={(file, title, month, year, onProgress) =>
                submit(file, title, month, year, recipients.map((recipient) => recipient.uid), onProgress)
              }
            />
          </>
        )}
      </details>

      <ReportList
        title="Your Submitted Reports"
        reports={reports}
        loading={loadingReports}
        emptyMessage="You haven't sent a monthly report yet."
        showUploader={false}
        onRefresh={loadReports}
      />
      {reportsError && <p role="alert" className="monthly-report-download__error">{reportsError}</p>}
    </>
  );
}
