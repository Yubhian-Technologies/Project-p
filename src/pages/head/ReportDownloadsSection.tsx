import { useState } from "react";
import { MonthlyReportDownload } from "../../components/reports/MonthlyReportDownload";
import { ConsolidatedReportDownloadSection } from "./ConsolidatedReportDownloadSection";
import { Card } from "../../components/common/Card";
import { Select } from "../../components/common/Select";
import "../../components/reports/MonthlyReportDownload.css";

type ReportKind = "monthly" | "consolidated";

/** Combines the Head's two self-service report downloads (My Monthly Report,
    Consolidated Report) into one sidebar section, picked via a dropdown,
    instead of two separate sidebar entries. */
export function ReportDownloadsSection() {
  const [kind, setKind] = useState<ReportKind>("monthly");

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

      {kind === "monthly" ? <MonthlyReportDownload /> : <ConsolidatedReportDownloadSection />}
    </div>
  );
}
