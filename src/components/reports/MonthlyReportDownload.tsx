import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { listCampuses } from "../../services/firebase/campuses";
import { listColleges } from "../../services/firebase/colleges";
import { gatherMonthlySessionData } from "../../utils/monthlyReportData";
import { generateMonthlyReportPdf } from "../../utils/monthlyReportPdf";
import { generateMonthlyReportDocx } from "../../utils/monthlyReportDocx";
import type { ReportSection } from "../../types/report";
import { Card } from "../common/Card";
import { Button } from "../common/Button";
import { Select } from "../common/Select";
import { MultiPhotoInput } from "../common/MultiPhotoInput";
import { ReportSectionsEditor } from "./ReportSectionsEditor";
import { XIcon } from "../common/icons";
import "./MonthlyReportDownload.css";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => THIS_YEAR - i);

type Format = "pdf" | "docx";
type Status = "idle" | "loading" | "generating" | "error";

const DEFAULT_SECTIONS: ReportSection[] = [
  { heading: "Meetings & Administrative Activities", items: [{ title: "", details: "" }] },
  { heading: "Summary of Activities Conducted", items: [{ title: "", details: "" }] },
];

export function MonthlyReportDownload() {
  const { profile } = useAuth();
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

  useEffect(() => {
    if (!profile?.campusId) return;
    if (profile.collegeId) {
      listColleges(profile.campusId).then((list) => {
        setInstitutionName(list.find((c) => c.id === profile.collegeId)?.name ?? "");
      });
    } else {
      // A Head oversees a whole campus, not one college — fall back to the
      // campus name for their own Monthly Report's "Institution" line.
      listCampuses().then((list) => {
        setInstitutionName(list.find((c) => c.id === profile.campusId)?.name ?? "");
      });
    }
  }, [profile?.campusId, profile?.collegeId]);

  function updateGoal(index: number, value: string) {
    setGoals((prev) => prev.map((g, i) => (i === index ? value : g)));
  }

  function addGoal() {
    setGoals((prev) => [...prev, ""]);
  }

  function removeGoal(index: number) {
    setGoals((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleDownload() {
    if (!profile) return;
    setStatus("loading");
    setError("");
    try {
      const sessionData = await gatherMonthlySessionData(profile.uid, year, monthIdx);
      setStatus("generating");
      const nextMonthIdx = (monthIdx + 1) % 12;
      const nextMonthYear = monthIdx === 11 ? year + 1 : year;
      const header = {
        monthLabel: `${MONTHS[monthIdx].toUpperCase()} ${year}`,
        nextMonthLabel: `${MONTHS[nextMonthIdx]} ${nextMonthYear}`,
        preparedByName: preparedByName.trim() || profile.displayName || profile.email,
        roleTitle: roleTitle.trim(),
        institutionName: institutionName || "—",
      };
      const input = { header, sections, goals, sessionData, photos };
      if (format === "pdf") {
        await generateMonthlyReportPdf(input);
      } else {
        await generateMonthlyReportDocx(input);
      }
      setStatus("idle");
    } catch (err) {
      console.error("Monthly report generation failed:", err);
      setError("Could not generate the report. Please try again.");
      setStatus("error");
    }
  }

  if (!profile) return null;

  const busy = status === "loading" || status === "generating";

  return (
    <div className="monthly-report-download">
      <Card className="monthly-report-download__card">
        <p className="monthly-report-download__intro">
          Counselling sessions for the selected month are counted automatically. Fill in the sections below with
          what happened this month, add photos if you like, and download.
        </p>

        <div className="monthly-report-download__row">
          <div className="monthly-report-download__field">
            <label htmlFor="mr-month">Month</label>
            <Select id="mr-month" value={String(monthIdx)} onChange={(v) => setMonthIdx(Number(v))}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i}>{m}</option>
              ))}
            </Select>
          </div>
          <div className="monthly-report-download__field">
            <label htmlFor="mr-year">Year</label>
            <Select id="mr-year" value={String(year)} onChange={(v) => setYear(Number(v))}>
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
          </div>
        </div>

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

        <div className="monthly-report-download__field">
          <label htmlFor="mr-format">Format</label>
          <Select id="mr-format" value={format} onChange={(v) => setFormat(v as Format)}>
            <option value="pdf">PDF</option>
            <option value="docx">Word (.docx)</option>
          </Select>
        </div>

        {error && <p className="monthly-report-download__error">{error}</p>}

        <Button type="button" disabled={busy} onClick={handleDownload}>
          {status === "loading" ? "Preparing…" : status === "generating" ? "Generating document…" : "Download Report"}
        </Button>
      </Card>
    </div>
  );
}
