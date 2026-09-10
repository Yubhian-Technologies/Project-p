import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  listMonthlyReports,
  uploadMonthlyReport,
  deleteMonthlyReport,
  type MonthlyReport,
} from "../../services/firebase/monthlyReports";
import "./MonthlyReportsSection.css";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const ACCEPTED_TYPES = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt";

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => THIS_YEAR - i);

function monthLabel(m: number) {
  return MONTHS[(m - 1 + 12) % 12];
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function MonthlyReportsSection() {
  const { profile } = useAuth();

  // ── upload form state ──────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(THIS_YEAR);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── list state ─────────────────────────────────────────────────────
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadReports() {
    setLoadingList(true);
    try {
      setReports(await listMonthlyReports());
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  // ── file pick helpers ──────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setUploadError("");
    setUploadSuccess("");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0] ?? null;
    if (f) {
      setFile(f);
      setUploadError("");
      setUploadSuccess("");
    }
  }

  // ── upload ─────────────────────────────────────────────────────────
  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setUploadError("Please select a file."); return; }
    if (!title.trim()) { setUploadError("Please enter a report title."); return; }

    setUploading(true);
    setUploadError("");
    setUploadSuccess("");
    setProgress(0);

    try {
      await uploadMonthlyReport(
        file,
        title.trim(),
        month,
        year,
        profile?.displayName || profile?.email || "Head",
        profile?.uid ?? "",
        setProgress,
      );
      setUploadSuccess("Report uploaded successfully!");
      setTitle("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadReports();
    } catch (err) {
      setUploadError("Upload failed. Please try again.");
      console.error(err);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  // ── delete ─────────────────────────────────────────────────────────
  async function handleDelete(report: MonthlyReport) {
    if (!window.confirm(`Delete "${report.title}"? This cannot be undone.`)) return;
    setDeletingId(report.id);
    try {
      await deleteMonthlyReport(report.id, report.storagePath);
      await loadReports();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mr-section">
      {/* ── Upload Card ─────────────────────────────────────────────── */}
      <div className="mr-upload-card">
        <h2 className="mr-upload-card__title">
          <span className="mr-upload-card__title-icon">📤</span>
          Upload Monthly Report
        </h2>

        <form className="mr-upload-card__form" onSubmit={handleUpload}>
          {/* Title */}
          <div className="mr-upload-card__field mr-upload-card__field--full">
            <label className="mr-upload-card__label" htmlFor="mr-title">
              Report Title
            </label>
            <input
              id="mr-title"
              className="mr-upload-card__input"
              type="text"
              placeholder="e.g. September 2026 Counselling Report"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Month */}
          <div className="mr-upload-card__field">
            <label className="mr-upload-card__label" htmlFor="mr-month">
              Month
            </label>
            <select
              id="mr-month"
              className="mr-upload-card__input"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Year */}
          <div className="mr-upload-card__field">
            <label className="mr-upload-card__label" htmlFor="mr-year">
              Year
            </label>
            <select
              id="mr-year"
              className="mr-upload-card__input"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Drop-zone */}
          <div className="mr-upload-card__field mr-upload-card__field--full">
            <label className="mr-upload-card__label">File</label>
            <div
              className={`mr-upload-card__dropzone${dragOver ? " mr-upload-card__dropzone--active" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              {file ? (
                <span className="mr-upload-card__selected-file">📎 {file.name}</span>
              ) : (
                <>
                  <span className="mr-upload-card__dropzone-icon">📁</span>
                  <span className="mr-upload-card__dropzone-text">
                    Click or drag &amp; drop to select file
                  </span>
                  <span className="mr-upload-card__dropzone-sub">
                    PDF, Word, Excel, PowerPoint, CSV — any document
                  </span>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
          </div>

          {/* Progress bar */}
          {uploading && (
            <div className="mr-upload-card__field mr-upload-card__field--full">
              <div className="mr-upload-card__progress-bar">
                <div
                  className="mr-upload-card__progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Actions + feedback */}
          <div className="mr-upload-card__actions">
            <button
              type="submit"
              className="mr-btn mr-btn--primary"
              disabled={uploading}
            >
              {uploading ? `Uploading… ${progress}%` : "Upload Report"}
            </button>
            {file && !uploading && (
              <button
                type="button"
                className="mr-btn mr-btn--ghost"
                onClick={() => {
                  setFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                Clear
              </button>
            )}
            {uploadError && <span className="mr-upload-card__error">⚠ {uploadError}</span>}
            {uploadSuccess && <span className="mr-upload-card__success">✓ {uploadSuccess}</span>}
          </div>
        </form>
      </div>

      {/* ── Reports List ─────────────────────────────────────────────── */}
      <div>
        <div className="mr-list__header">
          <h3 className="mr-list__title">Uploaded Reports</h3>
          <button type="button" className="mr-btn mr-btn--ghost" onClick={loadReports}>
            ↻ Refresh
          </button>
        </div>

        {loadingList ? (
          <p style={{ color: "var(--neu-text-muted)", fontSize: 14 }}>Loading…</p>
        ) : reports.length === 0 ? (
          <div className="mr-list__empty">
            <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
            <p>No reports uploaded yet.</p>
          </div>
        ) : (
          <div className="mr-list">
            {reports.map((r) => (
              <div key={r.id} className="mr-list__row">
                <div className="mr-list__row-info">
                  <span className="mr-list__row-title">{r.title}</span>
                  <span className="mr-list__row-meta">
                    📅 {monthLabel(r.month)} {r.year} &nbsp;·&nbsp; 📁 {r.fileName} &nbsp;·&nbsp; Uploaded {formatDate(r.uploadedAt)}
                  </span>
                </div>
                <div className="mr-list__row-actions">
                  <span className="mr-list__row-badge">
                    📅 {monthLabel(r.month)} {r.year}
                  </span>
                  <a
                    href={r.downloadURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mr-btn mr-btn--download"
                  >
                    ⬇ Download
                  </a>
                  <button
                    type="button"
                    className="mr-btn mr-btn--danger"
                    disabled={deletingId === r.id}
                    onClick={() => handleDelete(r)}
                  >
                    {deletingId === r.id ? "Deleting…" : "🗑 Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
