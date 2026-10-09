import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { gatherConsolidatedReportData } from "../../utils/consolidatedReportData";
import { generateConsolidatedReportPdf } from "../../utils/consolidatedReportPdf";
import { generateConsolidatedReportDocx } from "../../utils/consolidatedReportDocx";
import type { ReportSection, ReportStatRow } from "../../types/report";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { Select } from "../../components/common/Select";
import { MultiPhotoInput } from "../../components/common/MultiPhotoInput";
import { ReportSectionsEditor } from "../../components/reports/ReportSectionsEditor";
import { ReportStatRowsEditor } from "../../components/reports/ReportStatRowsEditor";
import "../../components/reports/MonthlyReportDownload.css";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => THIS_YEAR - i);

type Format = "pdf" | "docx";
type Status = "idle" | "loading" | "generating" | "error";

const DEFAULT_SECTIONS: ReportSection[] = [
  { heading: "Student Counselling & Follow-up", items: [{ title: "", details: "" }] },
  { heading: "Major Student Programmes", items: [{ title: "", details: "" }] },
  { heading: "Key Achievements", items: [{ title: "", details: "" }] },
  { heading: "Priorities for Next Month", items: [{ title: "", details: "" }] },
];

export function ConsolidatedReportDownloadSection() {
  const { profile } = useAuth();
  const now = new Date();
  const [monthIdx, setMonthIdx] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [extraStats, setExtraStats] = useState<ReportStatRow[]>([]);
  const [sections, setSections] = useState<ReportSection[]>(DEFAULT_SECTIONS);
  const [photos, setPhotos] = useState<File[]>([]);
  const [format, setFormat] = useState<Format>("pdf");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function handleDownload() {
    if (!profile?.campusId) return;
    setStatus("loading");
    setError("");
    try {
      const data = await gatherConsolidatedReportData(profile.campusId, year, monthIdx);
      setStatus("generating");
      const header = { monthLabel: `${MONTHS[monthIdx].toUpperCase()} ${year}` };
      const input = { header, extraStats, sections, data, photos };
      if (format === "pdf") {
        await generateConsolidatedReportPdf(input);
      } else {
        await generateConsolidatedReportDocx(input);
      }
      setStatus("idle");
    } catch (err) {
      console.error("Consolidated report generation failed:", err);
      setError("Could not generate the report. Please try again.");
      setStatus("error");
    }
  }

  if (!profile?.campusId) {
    return (
      <div className="monthly-report-download">
        <p className="monthly-report-download__intro">Your profile isn't linked to a campus yet.</p>
      </div>
    );
  }

  const busy = status === "loading" || status === "generating";

  return (
    <div className="monthly-report-download">
      <Card className="monthly-report-download__card">
        <p className="monthly-report-download__intro">
          Institution-wise session totals are pulled automatically from every counsellor and head on your campus
          for the selected month. Add anything the app doesn't track (Digital Detox, MINDTAP, etc.) and the
          narrative sections below, then download.
        </p>

        <div className="monthly-report-download__row">
          <div className="monthly-report-download__field">
            <label htmlFor="cr-month">Month</label>
            <Select id="cr-month" value={String(monthIdx)} onChange={(v) => setMonthIdx(Number(v))}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i}>{m}</option>
              ))}
            </Select>
          </div>
          <div className="monthly-report-download__field">
            <label htmlFor="cr-year">Year</label>
            <Select id="cr-year" value={String(year)} onChange={(v) => setYear(Number(v))}>
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
          </div>
        </div>

        <h3 className="monthly-report-download__section-title">Additional summary figures</h3>
        <ReportStatRowsEditor rows={extraStats} onChange={setExtraStats} />

        <h3 className="monthly-report-download__section-title">This month</h3>
        <ReportSectionsEditor sections={sections} onChange={setSections} />

        <div className="monthly-report-download__field">
          <label htmlFor="cr-photos">Photos (optional)</label>
          <MultiPhotoInput id="cr-photos" files={photos} onChange={setPhotos} disabled={busy} />
        </div>

        <div className="monthly-report-download__field">
          <label htmlFor="cr-format">Format</label>
          <Select id="cr-format" value={format} onChange={(v) => setFormat(v as Format)}>
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
