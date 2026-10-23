import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { listCampuses } from "../../services/firebase/campuses";
import { listColleges } from "../../services/firebase/colleges";
import {
  gatherCounsellorMonthlyAnalytics,
  gatherHeadMonthlyAnalytics,
  gatherMonthlySessionData,
  type CampusMonthlyAnalytics,
  type CounsellorMonthlyAnalytics,
} from "../../utils/monthlyReportData";
import type { MonthlyReportRecipient } from "../../services/firebase/counsellorMonthlyReports";
import type { ReportSection } from "../../types/report";
import { Card } from "../common/Card";
import { Button } from "../common/Button";
import { Select } from "../common/Select";
import { MultiPhotoInput } from "../common/MultiPhotoInput";
import { ReportSectionsEditor } from "./ReportSectionsEditor";
import { XIcon } from "../common/icons";
import { Activity, CalendarDays, HeartPulse, Users, UserRound, UserRoundCheck } from "lucide-react";
import "./MonthlyReportDownload.css";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => THIS_YEAR - i);

type Format = "pdf" | "docx";
type Status = "idle" | "loading" | "generating" | "submitting" | "error";

interface MonthlyReportDownloadProps {
  mode?: "counsellor" | "head";
  recipientOptions?: MonthlyReportRecipient[];
  recipientsLoading?: boolean;
  onSubmitReport?: (file: File, title: string, month: number, year: number, recipientUids: string[]) => Promise<void>;
}

type MonthlyAnalyticsResult =
  | { requestKey: string; status: "loaded"; data: CampusMonthlyAnalytics | CounsellorMonthlyAnalytics }
  | { requestKey: string; status: "error"; error: string };

const DEFAULT_SECTIONS: ReportSection[] = [
  { heading: "Meetings & Administrative Activities", items: [{ title: "", details: "" }] },
  { heading: "Summary of Activities Conducted", items: [{ title: "", details: "" }] },
];

const NO_RECIPIENT_OPTIONS: MonthlyReportRecipient[] = [];

export function MonthlyReportDownload({
  mode = "counsellor",
  recipientOptions = NO_RECIPIENT_OPTIONS,
  recipientsLoading = false,
  onSubmitReport,
}: MonthlyReportDownloadProps) {
  const { profile } = useAuth();
  const isCampusReport = mode === "head";
  const profileUid = profile?.uid;
  const profileCampusId = profile?.campusId;
  const now = new Date();
  const [monthIdx, setMonthIdx] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [preparedByName, setPreparedByName] = useState(profile?.displayName || profile?.email || "");
  const [roleTitle, setRoleTitle] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [sections, setSections] = useState<ReportSection[]>(DEFAULT_SECTIONS);
  const [goals, setGoals] = useState<string[]>([""]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [format, setFormat] = useState<Format>("pdf");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [analyticsResult, setAnalyticsResult] = useState<MonthlyAnalyticsResult | null>(null);
  const [recipientSelection, setRecipientSelection] = useState<{
    optionsKey: string;
    recipientUids: string[];
  } | null>(null);
  const recipientOptionsKey = recipientOptions.map((recipient) => recipient.uid).join("|");
  const defaultRecipientUidsKey = recipientOptions
    .filter((recipient) => recipient.defaultSelected)
    .map((recipient) => recipient.uid)
    .join("|");
  const selectedRecipientUids = recipientSelection?.optionsKey === recipientOptionsKey
    ? recipientSelection.recipientUids
    : defaultRecipientUidsKey
      ? defaultRecipientUidsKey.split("|")
      : [];

  useEffect(() => {
    let active = true;
    const campusId = profile?.campusId;
    if (!campusId) {
      return;
    }

    const loadInstitutionName = async () => {
      try {
        if (profile.collegeId) {
          const list = await listColleges(campusId);
          if (active) setInstitutionName(list.find((c) => c.id === profile.collegeId)?.name ?? "");
        } else {
          const list = await listCampuses();
          if (active) setInstitutionName(list.find((c) => c.id === campusId)?.name ?? "");
        }
      } catch (err) {
        console.error("Failed to load report institution:", err);
        if (active) setInstitutionName("");
      }
    };
    void loadInstitutionName();

    return () => {
      active = false;
    };
  }, [profile?.campusId, profile?.collegeId, isCampusReport]);

  useEffect(() => {
    if (!profileUid) return;
    const counsellorId = profileUid;
    const campusId = profileCampusId;
    if (isCampusReport && !campusId) return;

    let active = true;
    const requestMode = isCampusReport ? "head" : "counsellor";
    const requestKey = `${requestMode}:${counsellorId}:${campusId ?? ""}:${year}:${monthIdx}`;
    const loadAnalytics = isCampusReport && campusId
      ? gatherHeadMonthlyAnalytics(counsellorId, campusId, year, monthIdx)
      : gatherCounsellorMonthlyAnalytics(counsellorId, campusId, year, monthIdx);

    void loadAnalytics
      .then((analytics) => {
        if (active) setAnalyticsResult({ requestKey, status: "loaded", data: analytics });
      })
      .catch((err: unknown) => {
        console.error("Failed to load monthly report analytics:", err);
        if (active) {
          setAnalyticsResult({
            requestKey,
            status: "error",
            error: "Could not load activity for this month. Please try again.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [isCampusReport, monthIdx, profileCampusId, profileUid, year]);

  const analyticsRequestKey = profileUid
    ? `${mode}:${profileUid}:${profileCampusId ?? ""}:${year}:${monthIdx}`
    : "";
  const selectedAnalyticsResult =
    analyticsResult?.requestKey === analyticsRequestKey ? analyticsResult : null;
  const monthlyAnalytics =
    selectedAnalyticsResult?.status === "loaded" ? selectedAnalyticsResult.data : null;
  const analyticsLoading = Boolean(profile && (!isCampusReport || profile.campusId) && !selectedAnalyticsResult);
  const analyticsError =
    selectedAnalyticsResult?.status === "error" ? selectedAnalyticsResult.error : "";

  function updateGoal(index: number, value: string) {
    setGoals((prev) => prev.map((g, i) => (i === index ? value : g)));
  }

  function addGoal() {
    setGoals((prev) => [...prev, ""]);
  }

  function removeGoal(index: number) {
    setGoals((prev) => prev.filter((_, i) => i !== index));
  }

  async function generateReport(submitToHead = false) {
    if (!profile) return;
    if (isCampusReport && (!profile.campusId || !monthlyAnalytics || analyticsError)) return;
    if (submitToHead && !onSubmitReport) return;
    if (submitToHead && selectedRecipientUids.length === 0) {
      setError("Select at least one recipient in your college before sending this report.");
      return;
    }
    setStatus("loading");
    setError("");
    setSuccess("");
    try {
      const sessionData = isCampusReport && monthlyAnalytics
        ? { weeks: [], total: monthlyAnalytics.totalSessions }
        : await gatherMonthlySessionData(profile.uid, year, monthIdx);
      setStatus("generating");
      const nextMonthIdx = (monthIdx + 1) % 12;
      const nextMonthYear = monthIdx === 11 ? year + 1 : year;
      const header = {
        monthLabel: `${MONTHS[monthIdx].toUpperCase()} ${year}`,
        nextMonthLabel: `${MONTHS[nextMonthIdx]} ${nextMonthYear}`,
        preparedByName: preparedByName.trim() || profile.displayName || profile.email,
        roleTitle: isCampusReport ? "Head" : roleTitle.trim(),
        institutionName: institutionName || "—",
      };
      const input = {
        header,
        sections,
        goals,
        sessionData,
        photos,
        campusAnalytics: isCampusReport ? monthlyAnalytics ?? undefined : undefined,
      };
      let reportBlob: Blob;
      if (format === "pdf") {
        const { generateMonthlyReportPdf } = await import("../../utils/monthlyReportPdf");
        reportBlob = await generateMonthlyReportPdf(input);
      } else {
        const { generateMonthlyReportDocx } = await import("../../utils/monthlyReportDocx");
        reportBlob = await generateMonthlyReportDocx(input);
      }

      const extension = format === "pdf" ? "pdf" : "docx";
      const mimeType = format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      const fileName = `monthly-report-${header.monthLabel.replace(/\s/g, "-")}.${extension}`;
      if (submitToHead && onSubmitReport) {
        setStatus("submitting");
        const title = `${MONTHS[monthIdx]} ${year} Monthly Report`;
        await onSubmitReport(
          new File([reportBlob], fileName, { type: mimeType }),
          title,
          monthIdx + 1,
          year,
          selectedRecipientUids,
        );
        setSuccess("Monthly report sent to the selected college recipients.");
      } else {
        const downloadUrl = URL.createObjectURL(reportBlob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(downloadUrl);
      }
      setStatus("idle");
    } catch (err) {
      console.error("Monthly report generation failed:", err);
      setError(submitToHead
        ? "Could not prepare or submit the report. Please try again."
        : "Could not generate the report. Please try again.");
      setStatus("error");
    }
  }

  if (!profile) return null;

  const busy = status === "loading" || status === "generating" || status === "submitting";
  const missingCampus = isCampusReport && !profile?.campusId;
  const analyticsMessage = missingCampus
    ? "Your profile is not linked to a campus, so your monthly activity cannot be loaded."
    : analyticsError;
  const reportInstitutionName = missingCampus ? "" : institutionName;
  const analyticsRows = monthlyAnalytics
    ? [
        { label: "Individual counselling sessions", value: monthlyAnalytics.individualSessions, icon: UserRound },
        { label: "Follow-up sessions", value: monthlyAnalytics.followUpSessions, icon: UserRoundCheck },
        { label: "Crisis SOS cases", value: monthlyAnalytics.crisisSosCases, icon: HeartPulse },
        { label: "Events & programs", value: monthlyAnalytics.eventsAndPrograms, icon: CalendarDays },
        { label: "Group sessions", value: monthlyAnalytics.groupSessions, icon: Users },
      ]
    : [];

  return (
    <div className="monthly-report-download">
      <Card className="monthly-report-download__card">
        <p className="monthly-report-download__intro">
          {isCampusReport
            ? "Your monthly sessions and activity are gathered automatically. Add your report notes below the analytics and download the completed report."
            : onSubmitReport
              ? "Review your monthly activity, complete the report, choose recipients from your college, then send it or download a copy."
              : "Counselling sessions for the selected month are counted automatically. Fill in the sections below with what happened this month, add photos if you like, and download."}
        </p>

        <div className="monthly-report-download__row">
          <div className="monthly-report-download__field">
            <label htmlFor="mr-month">Month</label>
            <Select id="mr-month" value={String(monthIdx)} onChange={(v) => setMonthIdx(Number(v))}>
              {MONTHS.map((m, i) => (
                <option key={m} value={String(i)}>{m}</option>
              ))}
            </Select>
          </div>
          <div className="monthly-report-download__field">
            <label htmlFor="mr-year">Year</label>
            <Select id="mr-year" value={String(year)} onChange={(v) => setYear(Number(v))}>
              {YEARS.map((reportYear) => (
                <option key={reportYear} value={String(reportYear)}>{reportYear}</option>
              ))}
            </Select>
          </div>
        </div>

        <section className="monthly-report-analytics" aria-labelledby="mr-analytics-title" aria-live="polite">
            <div className="monthly-report-analytics__heading">
              <div>
                <h3 id="mr-analytics-title" className="monthly-report-download__section-title">
                  {MONTHS[monthIdx]} {year} sessions and activity
                </h3>
              </div>
            </div>
            {analyticsLoading ? (
              <p className="monthly-report-download__intro">Loading monthly activity…</p>
            ) : analyticsMessage ? (
              <p className="monthly-report-download__error" role="alert">{analyticsMessage}</p>
            ) : monthlyAnalytics ? (
              <>
                <div className="monthly-report-analytics__grid">
                  {analyticsRows.map(({ label, value, icon: Icon }) => (
                    <div className="monthly-report-analytics__stat" key={label}>
                      <span className="monthly-report-analytics__icon"><Icon aria-hidden="true" size={18} /></span>
                      <span className="monthly-report-analytics__label">{label}</span>
                      <strong className="monthly-report-analytics__value">{value}</strong>
                    </div>
                  ))}
                  <div className="monthly-report-analytics__stat monthly-report-analytics__stat--total">
                    <span className="monthly-report-analytics__icon"><Activity aria-hidden="true" size={18} /></span>
                    <span className="monthly-report-analytics__label">Total sessions (including SOS)</span>
                    <strong className="monthly-report-analytics__value">{monthlyAnalytics.totalSessions}</strong>
                  </div>
                </div>
                <p className="monthly-report-analytics__note">
                  {isCampusReport
                    ? "Counts include your completed sessions, follow-ups, and Crisis SOS cases assigned to you, plus completed events where you are listed as an organizer."
                    : "Counts include your completed sessions and SOS bookings assigned to you, plus completed events you organized."}
                </p>
              </>
            ) : null}
        </section>

        <div className="monthly-report-download__row">
          <div className="monthly-report-download__field">
            <label htmlFor="mr-prepared-by">Prepared by</label>
            <input
              id="mr-prepared-by"
              type="text"
              value={preparedByName}
              onChange={(e) => setPreparedByName(e.target.value)}
            />
          </div>
          {isCampusReport ? (
            <div className="monthly-report-download__field">
              <label htmlFor="mr-college">College</label>
              <input id="mr-college" type="text" value={reportInstitutionName} readOnly placeholder="Loading college…" />
            </div>
          ) : (
            <div className="monthly-report-download__field">
              <label htmlFor="mr-role-title">Role title</label>
              <input
                id="mr-role-title"
                type="text"
                placeholder="e.g. Senior Wellness Counsellor & Incharge"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
              />
            </div>
          )}
        </div>

        <h3 className="monthly-report-download__section-title">This month</h3>
        <ReportSectionsEditor sections={sections} onChange={setSections} />

        <h3 className="monthly-report-download__section-title">Goals for next month</h3>
        <div className="monthly-report-download__goals">
          {goals.map((goal, i) => (
            <div key={i} className="monthly-report-download__goal-row">
              <input
                type="text"
                placeholder={`Goal ${i + 1}`}
                value={goal}
                onChange={(e) => updateGoal(i, e.target.value)}
              />
              <button type="button" aria-label="Remove goal" onClick={() => removeGoal(i)}>
                <XIcon />
              </button>
            </div>
          ))}
          <Button type="button" variant="outlined" onClick={addGoal}>
            + Add goal
          </Button>
        </div>

        <div className="monthly-report-download__field">
          <label htmlFor="mr-photos">Photos (optional)</label>
          <MultiPhotoInput id="mr-photos" files={photos} onChange={setPhotos} disabled={busy} />
        </div>

        {onSubmitReport && (
          <fieldset className="monthly-report-download__recipients" disabled={busy || recipientsLoading}>
            <legend>Send this report to</legend>
            {recipientsLoading ? (
              <p>Loading recipients for your college…</p>
            ) : recipientOptions.length > 0 ? (
              recipientOptions.map((recipient) => (
                <label key={recipient.uid} className="monthly-report-download__recipient">
                  <input
                    type="checkbox"
                    checked={selectedRecipientUids.includes(recipient.uid)}
                    onChange={(event) => {
                      const recipientUids = event.target.checked
                        ? [...selectedRecipientUids, recipient.uid]
                        : selectedRecipientUids.filter((uid) => uid !== recipient.uid);
                      setRecipientSelection({ optionsKey: recipientOptionsKey, recipientUids });
                    }}
                  />
                  <span>{recipient.name}</span>
                  <small>
                    {recipient.role === "head"
                      ? "Head"
                      : recipient.role === "principal"
                        ? "Principal"
                        : "Vice Principal"}
                  </small>
                </label>
              ))
            ) : (
              <p>No eligible report recipients are assigned to your college.</p>
            )}
          </fieldset>
        )}

        <div className="monthly-report-download__field">
          <label htmlFor="mr-format">Format</label>
          <Select id="mr-format" value={format} onChange={(v) => setFormat(v as Format)}>
            <option value="pdf">PDF</option>
            <option value="docx">Word (.docx)</option>
          </Select>
        </div>

        {error && <p className="monthly-report-download__error">{error}</p>}

        <div className="monthly-report-download__actions">
          <Button
            type="button"
            variant="outlined"
            disabled={busy || (isCampusReport && (analyticsLoading || !monthlyAnalytics || Boolean(analyticsMessage)))}
            onClick={() => void generateReport()}
          >
            {status === "loading" ? "Preparing…" : status === "generating" ? "Generating document…" : "Download Report"}
          </Button>
          {onSubmitReport && (
            <Button
              type="button"
              disabled={
                busy ||
                recipientsLoading ||
                selectedRecipientUids.length === 0 ||
                recipientOptions.length === 0 ||
                (isCampusReport && (analyticsLoading || !monthlyAnalytics || Boolean(analyticsMessage)))
              }
              onClick={() => void generateReport(true)}
            >
              {status === "submitting" ? "Sending report…" : "Send Monthly Report"}
            </Button>
          )}
        </div>
        {success && <p className="monthly-report-download__success" role="status">{success}</p>}
      </Card>
    </div>
  );
}
