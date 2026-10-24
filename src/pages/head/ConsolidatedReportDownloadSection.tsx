import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { gatherConsolidatedReportData, type ConsolidatedReportData } from "../../utils/consolidatedReportData";
import type { ReportSection, ReportStatRow } from "../../types/report";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { Select } from "../../components/common/Select";
import { MultiPhotoInput } from "../../components/common/MultiPhotoInput";
import { ReportSectionsEditor } from "../../components/reports/ReportSectionsEditor";
import { ReportStatRowsEditor } from "../../components/reports/ReportStatRowsEditor";
import { ReportList } from "../../components/reports/ReportList";
import {
  listMonthlyReportsByCampus,
  uploadMonthlyReport,
  type MonthlyReport,
} from "../../services/firebase/monthlyReports";
import "../../components/reports/MonthlyReportDownload.css";
import "./ConsolidatedReportDownloadSection.css";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, index) => THIS_YEAR - index);

type Format = "pdf" | "docx";
type ActionStatus = "idle" | "generating" | "sharing";

const DEFAULT_SECTIONS: ReportSection[] = [
  { heading: "Student Counselling & Follow-up", items: [{ title: "", details: "" }] },
  { heading: "Major Student Programmes", items: [{ title: "", details: "" }] },
  { heading: "Key Achievements", items: [{ title: "", details: "" }] },
  { heading: "Priorities for Next Month", items: [{ title: "", details: "" }] },
];

function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function reportFile(blob: Blob, monthLabel: string, format: Format): File {
  const extension = format === "pdf" ? "pdf" : "docx";
  const mimeType =
    format === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return new File([blob], `consolidated-report-${monthLabel.replace(/\s/g, "-")}.${extension}`, {
    type: mimeType,
  });
}

function campusActivityMetrics(data: ConsolidatedReportData) {
  return [
    { label: "Total sessions", value: data.campus.totalSessions },
    { label: "Individual sessions", value: data.campus.individualSessions },
    { label: "Follow-up sessions", value: data.campus.followUpSessions },
    { label: "Crisis SOS cases", value: data.campus.crisisSosCases },
    { label: "Events & programs", value: data.campus.eventsAndPrograms },
    { label: "Group sessions", value: data.campus.groupSessions },
  ];
}

export function ConsolidatedReportDownloadSection() {
  const { profile } = useAuth();
  const campusId = profile?.campusId ?? "";
  const collegeId = profile?.collegeId ?? "";
  const profileUid = profile?.uid ?? "";
  const now = new Date();
  const [monthIdx, setMonthIdx] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [dataResult, setDataResult] = useState<{
    key: string;
    data: ConsolidatedReportData | null;
    error: string;
  }>({ key: "", data: null, error: "" });
  const [extraStats, setExtraStats] = useState<ReportStatRow[]>([]);
  const [sections, setSections] = useState<ReportSection[]>(DEFAULT_SECTIONS);
  const [photos, setPhotos] = useState<File[]>([]);
  const [format, setFormat] = useState<Format>("pdf");
  const [status, setStatus] = useState<ActionStatus>("idle");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reportsResult, setReportsResult] = useState<{
    key: string;
    reports: MonthlyReport[];
    error: string;
  }>({ key: "", reports: [], error: "" });
  const dataKey = `${campusId}:${year}:${monthIdx}`;
  const reportsKey = `${campusId}:${profileUid}`;
  const data = dataResult.key === dataKey ? dataResult.data : null;
  const loadingData = Boolean(campusId) && dataResult.key !== dataKey;
  const dataError = dataResult.key === dataKey ? dataResult.error : "";
  const reports = reportsResult.key === reportsKey ? reportsResult.reports : [];
  const currentPeriodReport = reports.find(
    (report) => report.month === monthIdx + 1 && report.year === year,
  );
  const loadingReports = Boolean(campusId && profileUid) && reportsResult.key !== reportsKey;
  const reportsError = reportsResult.key === reportsKey ? reportsResult.error : "";

  useEffect(() => {
    let active = true;
    if (!campusId) return;

    gatherConsolidatedReportData(campusId, year, monthIdx)
      .then((result) => {
        if (active) setDataResult({ key: dataKey, data: result, error: "" });
      })
      .catch((err: unknown) => {
        console.error("Failed to load consolidated campus report data:", err);
        if (active) {
          setDataResult({
            key: dataKey,
            data: null,
            error: "Could not load campus report data. Please try again.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [campusId, dataKey, monthIdx, year]);

  const loadReports = useCallback(async () => {
    if (!campusId || !profileUid) {
      return;
    }
    try {
      const campusReports = await listMonthlyReportsByCampus(campusId);
      setReportsResult({
        key: reportsKey,
        reports: campusReports.filter((report) => report.uploadedByUid === profileUid),
        error: "",
      });
    } catch (err) {
      console.error("Failed to load shared consolidated report history:", err);
      setReportsResult({
        key: reportsKey,
        reports: [],
        error: "Could not load your shared report history. Please refresh and try again.",
      });
    }
  }, [campusId, profileUid, reportsKey]);

  useEffect(() => {
    let active = true;
    if (!campusId || !profileUid) return;

    listMonthlyReportsByCampus(campusId)
      .then((campusReports) => {
        if (active) {
          setReportsResult({
            key: reportsKey,
            reports: campusReports.filter((report) => report.uploadedByUid === profileUid),
            error: "",
          });
        }
      })
      .catch((err: unknown) => {
        console.error("Failed to load shared consolidated report history:", err);
        if (active) {
          setReportsResult({
            key: reportsKey,
            reports: [],
            error: "Could not load your shared report history. Please refresh and try again.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [campusId, profileUid, reportsKey]);

  async function createReportFile(): Promise<{ file: File; monthLabel: string }> {
    if (!data) throw new Error("Campus report data is not ready.");
    const monthLabel = `${MONTHS[monthIdx].toUpperCase()} ${year}`;
    const input = { header: { monthLabel }, extraStats, sections, data, photos };
    const blob =
      format === "pdf"
        ? await (await import("../../utils/consolidatedReportPdf")).generateConsolidatedReportPdf(input)
        : await (await import("../../utils/consolidatedReportDocx")).generateConsolidatedReportDocx(input);
    return { file: reportFile(blob, monthLabel, format), monthLabel };
  }

  async function handleDownload() {
    setStatus("generating");
    setError("");
    setSuccess("");
    try {
      const { file } = await createReportFile();
      downloadFile(file);
      setSuccess("Your consolidated report is ready to download.");
    } catch (err) {
      console.error("Consolidated report generation failed:", err);
      setError("Could not generate the report. Please try again.");
    } finally {
      setStatus("idle");
    }
  }

  async function handleShare() {
    if (!profile?.uid || !campusId || !collegeId) {
      setError("Your Head profile must be linked to a campus and college before sharing.");
      return;
    }
    if (
      currentPeriodReport &&
      !window.confirm(
        `A consolidated report for ${MONTHS[monthIdx]} ${year} is already shared. Replace it with this version?`,
      )
    ) {
      return;
    }
    setStatus("sharing");
    setError("");
    setSuccess("");
    try {
      const { file, monthLabel } = await createReportFile();
      const title = `Consolidated Report — ${monthLabel}`;
      await uploadMonthlyReport(
        file,
        title,
        monthIdx + 1,
        year,
        profile.displayName || profile.email || "Head",
        profile.uid,
        undefined,
        campusId,
        collegeId,
      );
      await loadReports();
      setSuccess(
        currentPeriodReport
          ? "The consolidated report was replaced. Management, Administration, and you have been notified."
          : "The consolidated report was shared. Management, Administration, and you have been notified.",
      );
    } catch (err) {
      console.error("Consolidated report sharing failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Could not share the report. Please try again.",
      );
    } finally {
      setStatus("idle");
    }
  }

  if (!campusId || !collegeId) {
    return (
      <div className="monthly-report-download">
        <p className="monthly-report-download__intro">
          Your profile isn't linked to a campus and college yet.
        </p>
      </div>
    );
  }

  const busy = status !== "idle";
  const monthLabel = `${MONTHS[monthIdx]} ${year}`;

  return (
    <div className="monthly-report-download consolidated-report">
      <Card className="monthly-report-download__card">
        <p className="monthly-report-download__intro">
          Campus-wide figures and each counsellor's and Head's activity load automatically for the selected
          month. Add the narrative and summary figures below, then download or share the same report with
          Management and Administration.
        </p>

        <div className="monthly-report-download__row">
          <div className="monthly-report-download__field">
            <label htmlFor="cr-month">Month</label>
            <Select id="cr-month" value={String(monthIdx)} onChange={(value) => setMonthIdx(Number(value))}>
              {MONTHS.map((month, index) => (
                <option key={month} value={index}>{month}</option>
              ))}
            </Select>
          </div>
          <div className="monthly-report-download__field">
            <label htmlFor="cr-year">Year</label>
            <Select id="cr-year" value={String(year)} onChange={(value) => setYear(Number(value))}>
              {YEARS.map((yearOption) => (
                <option key={yearOption} value={yearOption}>{yearOption}</option>
              ))}
            </Select>
          </div>
        </div>

        <section className="consolidated-report__preview" aria-live="polite">
          <div className="consolidated-report__section-header">
            <div>
              <p className="consolidated-report__eyebrow">Campus-wide overview</p>
              <h3>{data?.campusName ?? "Campus activity"} · {monthLabel}</h3>
            </div>
            {loadingData && <span className="consolidated-report__loading">Updating figures…</span>}
          </div>
          {dataError ? (
            <p className="monthly-report-download__error" role="alert">{dataError}</p>
          ) : data ? (
            <>
              <div className="consolidated-report__metrics">
                {campusActivityMetrics(data).map((metric) => (
                  <div className="consolidated-report__metric" key={metric.label}>
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                  </div>
                ))}
              </div>
              <p className="consolidated-report__coverage">
                Includes {data.campus.staffCount} counsellor{data.campus.staffCount === 1 ? "" : "s"} and Head
                {data.campus.staffCount === 1 ? "" : "s"} across {data.campus.collegesCovered} college
                {data.campus.collegesCovered === 1 ? "" : "s"}.
              </p>

              <div className="consolidated-report__table-wrap">
                <table className="consolidated-report__table">
                  <caption>College and staff-wise activity for {monthLabel}</caption>
                  <thead>
                    <tr>
                      <th scope="col">College</th>
                      <th scope="col">Counsellor / Head</th>
                      <th scope="col">Role</th>
                      <th scope="col">Individual</th>
                      <th scope="col">Follow-up</th>
                      <th scope="col">Crisis SOS</th>
                      <th scope="col">Total sessions</th>
                      <th scope="col">Events & programs</th>
                      <th scope="col">Group sessions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.staffRows.length === 0 ? (
                      <tr>
                        <td colSpan={9}>No counsellor or Head activity was recorded for this month.</td>
                      </tr>
                    ) : (
                      data.staffRows.map((row) => (
                        <tr key={row.uid}>
                          <td>{row.collegeName}</td>
                          <td>{row.name}</td>
                          <td>{row.role === "head" ? "Head" : "Counsellor"}</td>
                          <td>{row.individualSessions}</td>
                          <td>{row.followUpSessions}</td>
                          <td>{row.crisisSosCases}</td>
                          <td>{row.totalSessions}</td>
                          <td>{row.eventsAndPrograms}</td>
                          <td>{row.groupSessions}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {data.staffRows.length > 0 && (
                    <tfoot>
                      <tr>
                        <th scope="row" colSpan={3}>Campus total</th>
                        <td>{data.campus.individualSessions}</td>
                        <td>{data.campus.followUpSessions}</td>
                        <td>{data.campus.crisisSosCases}</td>
                        <td>{data.campus.totalSessions}</td>
                        <td>{data.campus.eventsAndPrograms}</td>
                        <td>{data.campus.groupSessions}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </>
          ) : null}
        </section>

        <h3 className="monthly-report-download__section-title">Additional summary figures</h3>
        <ReportStatRowsEditor rows={extraStats} onChange={setExtraStats} />

        <h3 className="monthly-report-download__section-title">This month</h3>
        <ReportSectionsEditor sections={sections} onChange={setSections} />

        <div className="monthly-report-download__field">
          <label htmlFor="cr-photos">Photos (optional)</label>
          <MultiPhotoInput id="cr-photos" files={photos} onChange={setPhotos} disabled={busy} />
        </div>

        <div className="monthly-report-download__field">
          <label htmlFor="cr-format">Download / share format</label>
          <Select id="cr-format" value={format} onChange={(value) => setFormat(value as Format)}>
            <option value="pdf">PDF</option>
            <option value="docx">Word (.docx)</option>
          </Select>
        </div>

        {error && <p className="monthly-report-download__error" role="alert">{error}</p>}
        {success && <p className="consolidated-report__success" role="status">{success}</p>}

        <div className="consolidated-report__actions">
          <Button type="button" variant="outlined" disabled={busy || loadingData || !data} onClick={handleDownload}>
            {status === "generating" ? "Preparing download…" : "Download Report"}
          </Button>
          <Button
            type="button"
            disabled={busy || loadingData || loadingReports || Boolean(reportsError) || !data}
            onClick={handleShare}
          >
            {status === "sharing"
              ? currentPeriodReport ? "Resharing report…" : "Sharing report…"
              : currentPeriodReport
                ? "Reshare Consolidated Report"
                : "Share with Management & Administration"}
          </Button>
        </div>
      </Card>

      <ReportList
        title="Your shared consolidated reports"
        reports={reports}
        loading={loadingReports}
        emptyMessage="No consolidated reports have been shared from this account yet."
        showUploader={false}
        onRefresh={() => void loadReports()}
      />
      {reportsError && <p className="monthly-report-download__error" role="alert">{reportsError}</p>}
    </div>
  );
}
