import { useEffect, useMemo, useState } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { listCampuses } from "../../services/firebase/campuses";
import { listColleges } from "../../services/firebase/colleges";
import { createStudentLogin } from "../../services/firebase/managedAccounts";
import {
  buildStudentLoginRow,
  downloadLoginImportTemplate,
  parseLoginsSpreadsheet,
} from "../../utils/studentLoginImport";
import type { StudentLoginRow } from "../../utils/studentLoginImport";
import type { College } from "../../types/college";
import "./ImportLoginsModal.css";

interface ImportLoginsModalProps {
  campusId: string;
  onClose: () => void;
}

type Step = "upload" | "preview" | "importing" | "done";

interface ParsedSheet {
  headers: string[];
  rows: unknown[][];
}

interface PreviewRow {
  index: number;
  row: StudentLoginRow | null;
  invalidReason?: string;
}

interface ImportResult {
  succeeded: number;
  failed: { index: number; email: string; reason: string }[];
}

const CHUNK_SIZE = 5;

export function ImportLoginsModal({ campusId, onClose }: ImportLoginsModalProps) {
  const [step, setStep] = useState<Step>("upload");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [campusName, setCampusName] = useState("");
  const [colleges, setColleges] = useState<College[]>([]);
  const [loadingContext, setLoadingContext] = useState(true);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    Promise.all([listCampuses(), listColleges(campusId)]).then(([campuses, campusColleges]) => {
      setCampusName(campuses.find((c) => c.id === campusId)?.name ?? "");
      setColleges(campusColleges);
      setLoadingContext(false);
    });
  }, [campusId]);

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
    const seenEmails = new Set<string>();
    return sheet.rows.map((rawRow, index) => {
      const { row, invalidReason } = buildStudentLoginRow(sheet.headers, rawRow, colleges, campusName, seenEmails);
      return { index, row, invalidReason };
    });
  }, [sheet, colleges, campusName]);

  const validRows = previewRows.filter((r) => r.row !== null);
  const invalidRows = previewRows.filter((r) => r.row === null);

  async function handleImport() {
    setStep("importing");
    setProgress({ done: 0, total: validRows.length });
    const failed: { index: number; email: string; reason: string }[] = [];
    let succeeded = 0;

    for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
      const chunk = validRows.slice(i, i + CHUNK_SIZE);
      const outcomes = await Promise.allSettled(
        chunk.map((r) => createStudentLogin({ email: r.row!.email, collegeId: r.row!.collegeId })),
      );
      outcomes.forEach((outcome, offset) => {
        if (outcome.status === "fulfilled") {
          succeeded += 1;
        } else {
          failed.push({
            index: chunk[offset].index,
            email: chunk[offset].row!.email,
            reason: outcome.reason instanceof Error ? outcome.reason.message : "Import failed",
          });
        }
      });
      setProgress({ done: Math.min(i + CHUNK_SIZE, validRows.length), total: validRows.length });
    }

    setResult({ succeeded, failed });
    setStep("done");
  }

  return (
    <Modal title="Import Login Mails" onClose={onClose} className="import-logins-modal">
      {step === "upload" && (
        <div className="import-logins-modal__step">
          <p>
            Upload a spreadsheet of students to create logins for, on your campus
            {campusName ? ` (${campusName})` : ""}. It needs two columns: <strong>Email</strong> and{" "}
            <strong>College</strong>. Every account created here gets the default password{" "}
            <strong>123456</strong> — students can change it later from their own Profile page.
          </p>

          <button
            type="button"
            className="import-logins-modal__template-link"
            onClick={() => downloadLoginImportTemplate()}
          >
            Download a sample template (.xlsx) →
          </button>

          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            disabled={loadingContext}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelected(file);
            }}
          />
          {loadingContext && <p className="import-logins-modal__hint">Loading your campus's colleges…</p>}
          {uploadError && <p className="import-logins-modal__error">{uploadError}</p>}
        </div>
      )}

      {step === "preview" && (
        <div className="import-logins-modal__step">
          <p>
            <strong>{validRows.length}</strong> login{validRows.length === 1 ? "" : "s"} ready to create
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
                  <th>Email</th>
                  <th>College</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r) => (
                  <tr key={r.index} className={r.row ? "" : "import-logins-modal__row--invalid"}>
                    <td>{r.index + 2}</td>
                    <td>{r.row?.email ?? "—"}</td>
                    <td>{r.row?.collegeName ?? "—"}</td>
                    <td>{r.invalidReason ?? "Ready"}</td>
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
              Create {validRows.length} Login{validRows.length === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      )}

      {step === "importing" && (
        <div className="import-logins-modal__step">
          <p>
            Creating {progress.done} of {progress.total}…
          </p>
        </div>
      )}

      {step === "done" && result && (
        <div className="import-logins-modal__step">
          <p>
            <strong>{result.succeeded}</strong> login{result.succeeded === 1 ? "" : "s"} created
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
                  {f.email}: {f.reason}
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
