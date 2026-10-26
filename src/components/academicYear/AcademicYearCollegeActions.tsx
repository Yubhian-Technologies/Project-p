import { useEffect, useState } from "react";
import { useAcademicYear } from "../../hooks/useAcademicYear";
import {
  exportAcademicYearCollege,
  functionsErrorMessage,
  listAcademicYearArchiveRecords,
} from "../../services/firebase/functions";
import type { AcademicYearArchiveRecord, AcademicYearExportType } from "../../services/firebase/functions";
import type { AcademicYear } from "../../types/academicYear";
import { formatDateDMY } from "../../utils/formatDate";
import { Button } from "../common/Button";
import { Modal } from "../common/Modal";
import "./AcademicYearCollegeActions.css";

interface AcademicYearCollegeActionsProps {
  year: AcademicYear;
  collegeId: string;
  collegeName: string;
  campusName: string;
}

function safe(text: string): string {
  return text.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
}

function downloadText(fileName: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadReport(fileName: string, url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** One college of one academic year: export and search retained data. */
export function AcademicYearCollegeActions({
  year,
  collegeId,
  collegeName,
  campusName,
}: AcademicYearCollegeActionsProps) {
  const { reload } = useAcademicYear();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<AcademicYearExportType[]>([]);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveType, setArchiveType] = useState("sessions");
  const [archiveSearch, setArchiveSearch] = useState("");
  const [archiveRows, setArchiveRows] = useState<AcademicYearArchiveRecord[]>([]);
  const [archiveCursor, setArchiveCursor] = useState("");
  const [archiveHasMore, setArchiveHasMore] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState("");

  const exportInfo = year.exports?.[collegeId];
  const archive = year.archive?.[collegeId];
  const exportTypes: { id: AcademicYearExportType; label: string; description: string }[] = [
    { id: "sessions", label: "Session history", description: "Regular and follow-up sessions (CSV)" },
    { id: "crisis-sos", label: "Crisis SOS", description: "Crisis SOS sessions (CSV)" },
    { id: "serious-cases", label: "Serious cases", description: "Escalated and flagged cases (CSV)" },
    { id: "feedback", label: "Session feedback", description: "Student feedback and ratings (CSV)" },
    { id: "ssi", label: "SSI results", description: "Screening results (CSV)" },
    { id: "events", label: "Events", description: "Programs and events (CSV)" },
    { id: "monthly-reports", label: "Counsellor monthly reports", description: "Uploaded report files for this academic year" },
    { id: "consolidated-reports", label: "Consolidated reports", description: "Head-submitted report files for this academic year" },
  ];

  function toggleExportType(id: AcademicYearExportType | "all") {
    setSelectedTypes((current) => id === "all"
      ? current.length === exportTypes.length ? [] : exportTypes.map((type) => type.id)
      : current.includes(id) ? current.filter((type) => type !== id) : [...current, id]);
  }

  async function loadArchive(reset = false) {
    setArchiveLoading(true);
    setArchiveError("");
    if (reset) {
      setArchiveRows([]);
      setArchiveCursor("");
      setArchiveHasMore(false);
    }
    try {
      const result = await listAcademicYearArchiveRecords(
        year.id,
        collegeId,
        archiveType,
        archiveSearch || undefined,
        reset ? undefined : archiveCursor || undefined,
      );
      setArchiveRows((current) => reset ? result.records : [...current, ...result.records]);
      setArchiveCursor(result.nextCursor);
      setArchiveHasMore(result.hasMore);
    } catch (err) {
      setArchiveError(functionsErrorMessage(err, "Could not load archived records."));
    } finally {
      setArchiveLoading(false);
    }
  }

  useEffect(() => {
    if (!archiveOpen) return;
    const timer = window.setTimeout(() => void loadArchive(true), archiveSearch ? 350 : 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archiveOpen, archiveType, archiveSearch, year.id, collegeId]);

  async function handleDownload() {
    if (!selectedTypes.length) return;
    setBusy(true);
    setMessage("");
    try {
      const { files, counts } = await exportAcademicYearCollege(year.id, collegeId, selectedTypes);
      const prefix = [safe(campusName), safe(year.label), safe(collegeName)].join("_");
      for (const file of files) {
        if (file.downloadURL) downloadReport(`${prefix}_${file.name}`, file.downloadURL);
        else downloadText(`${prefix}_${file.name}`, file.content ?? "");
        // Small gap so the browser doesn't drop back-to-back downloads.
        await new Promise((resolve) => window.setTimeout(resolve, 300));
      }
      setMessage(`Downloaded ${files.length} selected file(s). ${counts.archivedRecordCount ?? 0} related records are archived for future Heads.`);
      setExportOpen(false);
      await reload();
    } catch (err) {
      setMessage(functionsErrorMessage(err, "Could not export this college's data. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  const visibleArchiveRows = archiveRows.filter((item) =>
    !archiveSearch.trim() || `${item.searchText} ${JSON.stringify(item.data)}`.toLowerCase().includes(archiveSearch.trim().toLowerCase()),
  );

  function archiveRecordTitle(item: AcademicYearArchiveRecord): string {
    const data = item.data;
    return String(data.studentName || data.userEmail || data.studentEmail || data.title || data.name || "Archived record");
  }

  function archiveRecordDate(item: AcademicYearArchiveRecord): string {
    const data = item.data;
    const raw = data.scheduledAt ?? data.eventDate ?? data.submittedAt ?? data.createdAt;
    const timestamp = typeof raw === "number"
      ? raw < 1_000_000_000_000 ? raw * 1000 : raw
      : typeof raw === "string" ? Date.parse(raw)
      : raw && typeof raw === "object" && typeof (raw as { _seconds?: unknown })._seconds === "number"
        ? Number((raw as { _seconds: number })._seconds) * 1000
        : NaN;
    return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString("en-IN") : "";
  }

  function archiveReadableDetails(item: AcademicYearArchiveRecord): [string, string][] {
    const hidden = new Set(["id", "userId", "studentId", "counsellorId", "collegeId", "campusId", "bookingId", "authorUid", "byUid", "targetAdminUids", "recipientUids", "organizerIds"]);
    return Object.entries(item.data)
      .filter(([key, value]) => !hidden.has(key) && value != null && (typeof value !== "object" || Array.isArray(value)))
      .map(([key, value]) => [key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase()), Array.isArray(value) ? value.map(String).join(", ") : String(value)]);
  }

  return (
    <div className="ay-college">
      <div className="ay-college__info">
        <span className="ay-college__name">{collegeName}</span>
        {archive ? (
          <span className="ay-college__status ay-college__status--deleted">
            Data deleted {formatDateDMY(archive.deletedAt)} · archived: {archive.archivedRecordCount ?? 0} records; kept summary: {archive.sessions} sessions, {archive.feedbackCount}{" "}
            feedback, {archive.ssiResults} SSI
          </span>
        ) : exportInfo ? (
          <span className="ay-college__status">
            {typeof exportInfo.archivedRecordCount === "number"
              ? `Last archived ${formatDateDMY(exportInfo.at)}`
              : "Older export found — export again to create a searchable archive"}
          </span>
        ) : (
          <span className="ay-college__status">Not exported yet</span>
        )}
        {message && <span className="ay-college__message">{message}</span>}
      </div>

      {typeof exportInfo?.archivedRecordCount === "number" && (
        <div className="ay-college__actions">
          <Button type="button" variant="outlined" onClick={() => setArchiveOpen(true)}>View academic-year data</Button>
        </div>
      )}
      {archive && typeof archive.archivedRecordCount !== "number" && (
        <span className="ay-college__message">This data was deleted before searchable archives were introduced; only its summary remains.</span>
      )}

      {!archive && (
        <div className="ay-college__actions">
          <Button type="button" variant="outlined" onClick={() => {
            setSelectedTypes([]);
            setExportOpen(true);
          }} disabled={busy}>
            {busy ? "Preparing…" : "Export data"}
          </Button>
        </div>
      )}

      {exportOpen && (
        <Modal title={`Export ${collegeName} — ${year.label}`} onClose={() => !busy && setExportOpen(false)} className="academic-year-data-modal">
          <div className="ay-college__export-options">
            <p>Choose which files to download. Records stay in the database and remain searchable by academic year.</p>
            <label className="ay-college__export-option">
              <input type="checkbox" checked={selectedTypes.length === exportTypes.length} onChange={() => toggleExportType("all")} />
              <span><strong>All data types</strong><small>Download a separate file for each type</small></span>
            </label>
            {exportTypes.map((type) => (
              <label className="ay-college__export-option" key={type.id}>
                <input type="checkbox" checked={selectedTypes.includes(type.id)} onChange={() => toggleExportType(type.id)} />
                <span><strong>{type.label}</strong><small>{type.description}</small></span>
              </label>
            ))}
            <div className="ay-college__confirm-actions">
              <Button type="button" variant="outlined" onClick={() => setExportOpen(false)} disabled={busy}>Cancel</Button>
              <Button type="button" onClick={handleDownload} disabled={!selectedTypes.length || busy}>
                {busy ? "Preparing archive…" : "Download selected files"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {archiveOpen && (
        <Modal title={`Archived data — ${collegeName}, ${year.label}`} onClose={() => setArchiveOpen(false)} className="academic-year-data-modal">
          <div className="ay-college__archive-viewer">
            <label className="ay-college__archive-filter">
              <span>Data type</span>
              <select value={archiveType} onChange={(event) => setArchiveType(event.target.value)}>
                {[...exportTypes.map((type) => type.id), "chat-messages", "session-resources", "session-private"].map((type) => (
                  <option value={type} key={type}>{type.replace(/-/g, " ").replace(/^./, (letter) => letter.toUpperCase())}</option>
                ))}
              </select>
            </label>
            <label className="ay-college__archive-filter">
              <span>Search this archive</span>
              <input value={archiveSearch} onChange={(event) => setArchiveSearch(event.target.value)} placeholder="Enter a full name, email, or word" />
            </label>
            {archiveError && <p className="ay-college__message">{archiveError}</p>}
            {archiveLoading && <p>Loading archive…</p>}
            {!archiveLoading && visibleArchiveRows.length === 0 && <p>No matching archived records on this page.</p>}
            <div className="ay-college__archive-list">
              {visibleArchiveRows.map((item) => (
                <details className="ay-college__archive-record" key={item.id}>
                  <summary><strong>{archiveRecordTitle(item)}</strong>{archiveRecordDate(item) && <span>{archiveRecordDate(item)}</span>}</summary>
                  <dl>{archiveReadableDetails(item).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
                </details>
              ))}
            </div>
            {archiveHasMore && <Button type="button" variant="outlined" onClick={() => loadArchive(false)} disabled={archiveLoading}>Load more records</Button>}
            {archiveRows.length > 0 && <small>Search matches exact names, emails, and words in archived records.</small>}
          </div>
        </Modal>
      )}
    </div>
  );
}
