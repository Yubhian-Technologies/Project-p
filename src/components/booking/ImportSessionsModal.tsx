import { useMemo, useState } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { Select } from "../common/Select";
import { importOfflineSession } from "../../services/firebase/bookings";
import {
  IMPORT_FIELDS,
  buildOfflineSessionRow,
  downloadImportTemplate,
  guessColumnMapping,
  parseSpreadsheet,
} from "../../utils/offlineSessionImport";
import type { ImportField, OfflineSessionRow } from "../../utils/offlineSessionImport";
import { formatDateTimeDMY } from "../../utils/formatDate";
import "./ImportSessionsModal.css";

interface ImportSessionsModalProps {
  counsellor: { uid: string; email: string };
  onClose: () => void;
  onImported: () => void;
}

type Step = "upload" | "map" | "preview" | "importing" | "done";

interface ParsedSheet {
  headers: string[];
  rows: unknown[][];
}

interface PreviewRow {
  index: number;
  row: OfflineSessionRow | null;
  warnings: string[];
  invalidReason?: string;
}

interface ImportResult {
  succeeded: number;
  failed: { index: number; reason: string }[];
}

const CHUNK_SIZE = 5;

export function ImportSessionsModal({ counsellor, onClose, onImported }: ImportSessionsModalProps) {
  const [step, setStep] = useState<Step>("upload");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<ImportField, number>>>({});
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleFileSelected(file: File) {
    setUploadError(null);
    try {
      const parsed = await parseSpreadsheet(file);
      if (parsed.rows.length === 0) {
        setUploadError("No data rows found in that file.");
        return;
      }
      setSheet(parsed);
      setMapping(guessColumnMapping(parsed.headers));
      setStep("map");
    } catch {
      setUploadError("Could not read that file. Make sure it's a valid .xlsx, .xls, or .csv file.");
    }
  }

  const previewRows: PreviewRow[] = useMemo(() => {
    if (!sheet) return [];
    return sheet.rows.map((rawRow, index) => {
      const { row, warnings, invalidReason } = buildOfflineSessionRow(rawRow, mapping);
      return { index, row, warnings, invalidReason };
    });
  }, [sheet, mapping]);

  const validRows = previewRows.filter((r) => r.row !== null);
  const invalidRows = previewRows.filter((r) => r.row === null);

  const canProceedToPreview = mapping.clientName !== undefined && mapping.date !== undefined;

  async function handleImport() {
    setStep("importing");
    setProgress({ done: 0, total: validRows.length });
    const failed: { index: number; reason: string }[] = [];
    let succeeded = 0;

    for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
      const chunk = validRows.slice(i, i + CHUNK_SIZE);
      const outcomes = await Promise.allSettled(
        chunk.map((r) => importOfflineSession(counsellor, r.row!)),
      );
      outcomes.forEach((outcome, offset) => {
        if (outcome.status === "fulfilled") {
          succeeded += 1;
        } else {
          failed.push({
            index: chunk[offset].index,
            reason: outcome.reason instanceof Error ? outcome.reason.message : "Import failed",
          });
        }
      });
      setProgress({ done: Math.min(i + CHUNK_SIZE, validRows.length), total: validRows.length });
    }

    setResult({ succeeded, failed });
    setStep("done");
    onImported();
  }

  return (
    <Modal title="Import Offline Sessions" onClose={onClose} className="import-sessions-modal">
      {step === "upload" && (
        <div className="import-sessions-modal__step">
          <p>
            Upload the Excel or CSV sheet where you log offline (in-person) sessions. Your existing sheet's
            column names don't need to match anything exact — the next step lets you match each of your columns
            to what it means.
          </p>

          <div className="import-sessions-modal__field-guide">
            <p className="import-sessions-modal__field-guide-title">What this can capture, if your sheet has it:</p>
            <ul>
              {IMPORT_FIELDS.map((field) => (
                <li key={field.id}>
                  {field.label}
                  {field.required ? " (required)" : ""}
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            className="import-sessions-modal__template-link"
            onClick={() => downloadImportTemplate()}
          >
            Download a sample template (.xlsx) →
          </button>

          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelected(file);
            }}
          />
          {uploadError && <p className="import-sessions-modal__error">{uploadError}</p>}
        </div>
      )}

      {step === "map" && sheet && (
        <div className="import-sessions-modal__step">
          <p>Match each field to a column from your sheet.</p>
          <div className="import-sessions-modal__mapping">
            {IMPORT_FIELDS.map((field) => (
              <div key={field.id} className="import-sessions-modal__mapping-row">
                <label>
                  {field.label}
                  {field.required ? " *" : ""}
                </label>
                <Select
                  value={mapping[field.id] !== undefined ? String(mapping[field.id]) : ""}
                  onChange={(v) =>
                    setMapping((prev) => ({
                      ...prev,
                      [field.id]: v === "" ? undefined : Number(v),
                    }))
                  }
                >
                  <option value="">— Not in sheet —</option>
                  {sheet.headers.map((header, index) => (
                    <option key={index} value={String(index)}>
                      {header || `Column ${index + 1}`}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
          <div className="import-sessions-modal__actions">
            <Button type="button" variant="outlined" onClick={() => setStep("upload")}>
              Back
            </Button>
            <Button type="button" disabled={!canProceedToPreview} onClick={() => setStep("preview")}>
              Next
            </Button>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="import-sessions-modal__step">
          <p>
            <strong>{validRows.length}</strong> session{validRows.length === 1 ? "" : "s"} ready to import
            {invalidRows.length > 0 && (
              <>
                {" "}
                — <strong>{invalidRows.length}</strong> row{invalidRows.length === 1 ? "" : "s"} will be skipped
              </>
            )}
            .
          </p>

          <div className="import-sessions-modal__preview-table-wrap">
            <table className="import-sessions-modal__preview-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Client</th>
                  <th>Date &amp; time</th>
                  <th>Duration</th>
                  <th>Rating</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(0, 10).map((r) => (
                  <tr key={r.index} className={r.row ? "" : "import-sessions-modal__row--invalid"}>
                    <td>{r.index + 2}</td>
                    <td>{r.row?.clientName ?? "—"}</td>
                    <td>{r.row ? formatDateTimeDMY(r.row.scheduledAt) : "—"}</td>
                    <td>{r.row ? `${r.row.durationMinutes}m` : "—"}</td>
                    <td>{r.row?.userRating ?? "—"}</td>
                    <td>
                      {r.invalidReason ?? (r.warnings.length > 0 ? r.warnings.join("; ") : "")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {previewRows.length > 10 && (
              <p className="import-sessions-modal__hint">Showing the first 10 of {previewRows.length} rows.</p>
            )}
          </div>

          <div className="import-sessions-modal__actions">
            <Button type="button" variant="outlined" onClick={() => setStep("map")}>
              Back
            </Button>
            <Button type="button" disabled={validRows.length === 0} onClick={handleImport}>
              Import {validRows.length} Session{validRows.length === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      )}

      {step === "importing" && (
        <div className="import-sessions-modal__step">
          <p>
            Importing {progress.done} of {progress.total}…
          </p>
        </div>
      )}

      {step === "done" && result && (
        <div className="import-sessions-modal__step">
          <p>
            <strong>{result.succeeded}</strong> session{result.succeeded === 1 ? "" : "s"} imported
            {result.failed.length > 0 && (
              <>
                , <strong>{result.failed.length}</strong> failed
              </>
            )}
            .
          </p>
          {result.failed.length > 0 && (
            <ul className="import-sessions-modal__failed-list">
              {result.failed.map((f) => (
                <li key={f.index}>
                  Row {f.index + 2}: {f.reason}
                </li>
              ))}
            </ul>
          )}
          <div className="import-sessions-modal__actions">
            <Button type="button" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
