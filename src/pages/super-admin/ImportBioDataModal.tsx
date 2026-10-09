import { useEffect, useMemo, useState } from "react";
import { Modal } from "../../components/common/Modal";
import { Button } from "../../components/common/Button";
import { listUsersByRole, updateUserBioData } from "../../services/firebase/firestore";
import { parseLoginsSpreadsheet } from "../../utils/studentLoginImport";
import { buildBioDataRow, downloadBioDataImportTemplate } from "../../utils/bioDataImport";
import type { BioDataImportRow } from "../../utils/bioDataImport";
import type { UserProfile } from "../../types/user";
import "../../components/profile/ImportLoginsModal.css";

interface ImportBioDataModalProps {
  onClose: () => void;
}

type Step = "upload" | "preview" | "importing" | "done";

interface ParsedSheet {
  headers: string[];
  rows: unknown[][];
}

interface PreviewRow {
  index: number;
  row: BioDataImportRow | null;
  warnings: string[];
  invalidReason?: string;
}

interface ImportResult {
  succeeded: number;
  failed: { index: number; registerNumber: string; reason: string }[];
}

const CHUNK_SIZE = 5;

export function ImportBioDataModal({ onClose }: ImportBioDataModalProps) {
  const [step, setStep] = useState<Step>("upload");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    listUsersByRole("user").then((list) => {
      setStudents(list);
      setLoadingStudents(false);
    });
  }, []);

  const studentsByRegisterNumber = useMemo(() => {
    const map = new Map<string, UserProfile>();
    for (const student of students) {
      if (student.registerNumber) map.set(student.registerNumber.toUpperCase().trim(), student);
    }
    return map;
  }, [students]);

  async function handleFileSelected(file: File) {
    setUploadError(null);
    try {
      const parsed = await parseLoginsSpreadsheet(file);
      if (parsed.rows.length === 0) {
        setUploadError("No data rows found in that file.");
        return;
      }
      setSheet(parsed);
      setStep("preview");
    } catch {
      setUploadError("Could not read that file. Make sure it's a valid .xlsx, .xls, or .csv file.");
    }
  }

  const previewRows: PreviewRow[] = useMemo(() => {
    if (!sheet) return [];
    const seenRegisterNumbers = new Set<string>();
    return sheet.rows.map((rawRow, index) => {
      const { row, warnings, invalidReason } = buildBioDataRow(
        sheet.headers,
        rawRow,
        studentsByRegisterNumber,
        seenRegisterNumbers,
      );
      return { index, row, warnings, invalidReason };
    });
  }, [sheet, studentsByRegisterNumber]);

  const validRows = previewRows.filter((r) => r.row !== null);
  const invalidRows = previewRows.filter((r) => r.row === null);

  async function handleImport() {
    setStep("importing");
    setProgress({ done: 0, total: validRows.length });
    const failed: { index: number; registerNumber: string; reason: string }[] = [];
    let succeeded = 0;

    for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
      const chunk = validRows.slice(i, i + CHUNK_SIZE);
      const outcomes = await Promise.allSettled(
        chunk.map((r) => updateUserBioData(r.row!.uid, r.row!.bioData)),
      );
      outcomes.forEach((outcome, offset) => {
        if (outcome.status === "fulfilled") {
          succeeded += 1;
        } else {
          failed.push({
            index: chunk[offset].index,
            registerNumber: chunk[offset].row!.registerNumber,
            reason: outcome.reason instanceof Error ? outcome.reason.message : "Update failed",
          });
        }
      });
      setProgress({ done: Math.min(i + CHUNK_SIZE, validRows.length), total: validRows.length });
    }

    setResult({ succeeded, failed });
    setStep("done");
  }

  return (
    <Modal title="Import Bio Data" onClose={onClose} className="import-logins-modal">
      {step === "upload" && (
        <div className="import-logins-modal__step">
          <p>
            Upload a spreadsheet of student bio data — personal and parent/guardian details. Each row is matched to
            an existing student purely by <strong>Register Number</strong>; rows with no matching account, or no
            Register Number at all, are skipped. <strong>Name</strong>, <strong>Branch</strong>, <strong>Batch</strong>,
            and <strong>Gender</strong> columns are optional and only used to flag a possible mismatch in the
            preview — they're never written back, since those are already managed elsewhere. A blank cell leaves
            that field as-is rather than clearing it, so a partial sheet (e.g. parent details only) is safe to
            import without affecting anything already filled in.
          </p>

          <button
            type="button"
            className="import-logins-modal__template-link"
            onClick={() => downloadBioDataImportTemplate()}
          >
            Download a sample template (.xlsx) →
          </button>

          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            disabled={loadingStudents}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelected(file);
            }}
          />
          {loadingStudents && <p className="import-logins-modal__hint">Loading students…</p>}
          {uploadError && <p className="import-logins-modal__error">{uploadError}</p>}
        </div>
      )}

      {step === "preview" && (
        <div className="import-logins-modal__step">
          <p>
            <strong>{validRows.length}</strong> row{validRows.length === 1 ? "" : "s"} ready to apply
            {invalidRows.length > 0 && (
              <>
                {" "}
                — <strong>{invalidRows.length}</strong> row{invalidRows.length === 1 ? "" : "s"} will be skipped
              </>
            )}
            .
          </p>

          <div className="import-logins-modal__preview-table-wrap">
            <table className="import-logins-modal__preview-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Register Number</th>
                  <th>Matched account</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r) => (
                  <tr key={r.index} className={r.row ? "" : "import-logins-modal__row--invalid"}>
                    <td>{r.index + 2}</td>
                    <td>{r.row?.registerNumber ?? "—"}</td>
                    <td>{r.row ? `${r.row.accountName} (${r.row.accountEmail})` : "—"}</td>
                    <td>{r.invalidReason ?? (r.warnings.length > 0 ? r.warnings.join("; ") : "Ready")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="import-logins-modal__actions">
            <Button type="button" variant="outlined" onClick={() => setStep("upload")}>
              Back
            </Button>
            <Button type="button" disabled={validRows.length === 0} onClick={handleImport}>
              Apply to {validRows.length} Student{validRows.length === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      )}

      {step === "importing" && (
        <div className="import-logins-modal__step">
          <p>
            Updating {progress.done} of {progress.total}…
          </p>
        </div>
      )}

      {step === "done" && result && (
        <div className="import-logins-modal__step">
          <p>
            <strong>{result.succeeded}</strong> student{result.succeeded === 1 ? "" : "s"} updated
            {result.failed.length > 0 && (
              <>
                , <strong>{result.failed.length}</strong> failed
              </>
            )}
            .
          </p>
          {result.failed.length > 0 && (
            <ul className="import-logins-modal__failed-list">
              {result.failed.map((f) => (
                <li key={f.index}>
                  {f.registerNumber}: {f.reason}
                </li>
              ))}
            </ul>
          )}
          <div className="import-logins-modal__actions">
            <Button type="button" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
