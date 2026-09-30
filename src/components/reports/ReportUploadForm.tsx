import { useRef, useState } from "react";
import { useSpeechToText } from "../../hooks/useSpeechToText";
import { Select } from "../common/Select";
import {
  FolderOpenIcon,
  PaperclipIcon,
  MicIcon,
  CheckIcon,
  AlertTriangleIcon,
} from "../common/icons";
import "./ReportUploadForm.css";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const ACCEPTED_TYPES = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt";

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => THIS_YEAR - i);

export interface ReportUploadFormProps {
  heading: string;
  titlePlaceholder: string;
  submitLabel?: string;
  /** Set to false to hide the "Speak to write" voice-to-text control. */
  allowVoiceInput?: boolean;
  onUpload: (
    file: File,
    title: string,
    month: number,
    year: number,
    onProgress: (pct: number) => void,
  ) => Promise<void>;
}

/** A file-upload form (title/month/year/file + optional voice-to-text +
    drag-drop), shared by the counsellor's "submit monthly report" and the
    head's "submit consolidated report" screens. */
export function ReportUploadForm({
  heading,
  titlePlaceholder,
  submitLabel = "Upload Report",
  allowVoiceInput = true,
  onUpload,
}: ReportUploadFormProps) {
  const [title, setTitle] = useState("");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(THIS_YEAR);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const voicePrefixRef = useRef("");
  const { supported: voiceSupported, listening: voiceListening, toggle: toggleVoice } = useSpeechToText(
    (text) => {
      const prefix = voicePrefixRef.current;
      const spacer =
        prefix && !prefix.endsWith(" ") && !prefix.endsWith("\n") && !prefix.endsWith(".") ? " " : "";
      setTitle(prefix + spacer + text);
    },
  );

  function handleVoiceToggle() {
    if (!voiceListening) voicePrefixRef.current = title;
    toggleVoice();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setError("");
    setSuccess("");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0] ?? null;
    if (f) {
      setFile(f);
      setError("");
      setSuccess("");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError("Please select a file."); return; }
    if (!title.trim()) { setError("Please enter a report title."); return; }

    setUploading(true);
    setError("");
    setSuccess("");
    setProgress(0);
    try {
      await onUpload(file, title.trim(), month, year, setProgress);
      setSuccess("Report submitted successfully!");
      setTitle("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? ` (${(err as { code: string }).code})` : "";
      setError(`Submission failed${code}. Please try again.`);
      console.error(err);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  return (
    <div className="report-upload-card">
      <h2 className="report-upload-card__title">
        <span className="report-upload-card__title-icon">
          <FolderOpenIcon />
        </span>
        {heading}
      </h2>

      <form className="report-upload-card__form" onSubmit={handleSubmit}>
        <div className="report-upload-card__field report-upload-card__field--full">
          <div className="report-upload-card__label-row">
            <label className="report-upload-card__label" htmlFor="report-title">
              Report Title
            </label>
            {allowVoiceInput && (
              voiceSupported ? (
                <button
                  type="button"
                  className={`report-upload-card__btn report-upload-card__btn--voice${voiceListening ? " report-upload-card__btn--voice-active" : ""}`}
                  onClick={handleVoiceToggle}
                >
                  <MicIcon />
                  {voiceListening ? "Stop & Insert" : "Speak to write"}
                </button>
              ) : (
                <span className="report-upload-card__voice-hint">Voice input needs Chrome or Edge on desktop.</span>
              )
            )}
          </div>
          <input
            id="report-title"
            className="report-upload-card__input"
            type="text"
            placeholder={titlePlaceholder}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          {allowVoiceInput && voiceListening && (
            <p className="report-upload-card__voice-status">
              Listening… speak now — your words appear here and you can correct them before submitting.
            </p>
          )}
        </div>

        <div className="report-upload-card__field">
          <label className="report-upload-card__label" htmlFor="report-month">Month</label>
          <Select id="report-month" value={String(month)} onChange={(v) => setMonth(Number(v))}>
            {MONTHS.map((m, i) => (
              <option key={m} value={String(i + 1)}>{m}</option>
            ))}
          </Select>
        </div>

        <div className="report-upload-card__field">
          <label className="report-upload-card__label" htmlFor="report-year">Year</label>
          <Select id="report-year" value={String(year)} onChange={(v) => setYear(Number(v))}>
            {YEARS.map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </Select>
        </div>

        <div className="report-upload-card__field report-upload-card__field--full">
          <label className="report-upload-card__label">File</label>
          <div
            className={`report-upload-card__dropzone${dragOver ? " report-upload-card__dropzone--active" : ""}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {file ? (
              <span className="report-upload-card__selected-file">
                <PaperclipIcon /> {file.name}
              </span>
            ) : (
              <>
                <span className="report-upload-card__dropzone-icon">
                  <FolderOpenIcon />
                </span>
                <span className="report-upload-card__dropzone-text">Click or drag &amp; drop to select file</span>
                <span className="report-upload-card__dropzone-sub">PDF, Word, Excel, PowerPoint, CSV — any document</span>
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

        {uploading && (
          <div className="report-upload-card__field report-upload-card__field--full">
            <div className="report-upload-card__progress-bar">
              <div className="report-upload-card__progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <div className="report-upload-card__actions">
          <button type="submit" className="report-upload-card__btn report-upload-card__btn--primary" disabled={uploading}>
            {uploading ? `Submitting… ${progress}%` : submitLabel}
          </button>
          {file && !uploading && (
            <button
              type="button"
              className="report-upload-card__btn report-upload-card__btn--ghost"
              onClick={() => {
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            >
              Clear
            </button>
          )}
          {error && (
            <span className="report-upload-card__error">
              <AlertTriangleIcon /> {error}
            </span>
          )}
          {success && (
            <span className="report-upload-card__success">
              <CheckIcon /> {success}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
