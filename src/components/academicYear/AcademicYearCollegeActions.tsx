import { useState } from "react";
import { useAcademicYear } from "../../hooks/useAcademicYear";
import {
  deleteAcademicYearCollegeData,
  exportAcademicYearCollege,
  functionsErrorMessage,
} from "../../services/firebase/functions";
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
  /** Delete is only ever offered to the Head / global Admin / Super Admin. */
  canDelete: boolean;
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

/** One college of one academic year: download its data, and (once closed + exported) delete it. */
export function AcademicYearCollegeActions({
  year,
  collegeId,
  collegeName,
  campusName,
  canDelete,
}: AcademicYearCollegeActionsProps) {
  const { reload } = useAcademicYear();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const exportInfo = year.exports?.[collegeId];
  const archive = year.archive?.[collegeId];
  const expected = `DELETE ${year.label}`;

  async function handleDownload() {
    setBusy(true);
    setMessage("");
    try {
      const { files, counts } = await exportAcademicYearCollege(year.id, collegeId);
      const prefix = [safe(campusName), safe(year.label), safe(collegeName)].join("_");
      for (const file of files) {
        downloadText(`${prefix}_${file.name}`, file.content);
        // Small gap so the browser doesn't drop back-to-back downloads.
        await new Promise((resolve) => window.setTimeout(resolve, 300));
      }
      setMessage(
        `Downloaded ${counts.sessions} session(s), ${counts.feedback} feedback, ${counts.ssiResults} SSI result(s), ${counts.events} event(s).`,
      );
      await reload();
    } catch (err) {
      setMessage(functionsErrorMessage(err, "Could not export this college's data. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    setMessage("");
    try {
      await deleteAcademicYearCollegeData(year.id, collegeId, confirmText.trim());
      setConfirmOpen(false);
      setConfirmText("");
      setMessage("This college's data for the year was deleted. A summary was kept.");
      await reload();
    } catch (err) {
      setMessage(functionsErrorMessage(err, "Could not delete this college's data. Please try again."));
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ay-college">
      <div className="ay-college__info">
        <span className="ay-college__name">{collegeName}</span>
        {archive ? (
          <span className="ay-college__status ay-college__status--deleted">
            Data deleted {formatDateDMY(archive.deletedAt)} · kept: {archive.sessions} sessions, {archive.feedbackCount}{" "}
            feedback, {archive.ssiResults} SSI
          </span>
        ) : exportInfo ? (
          <span className="ay-college__status">Last exported {formatDateDMY(exportInfo.at)}</span>
        ) : (
          <span className="ay-college__status">Not exported yet</span>
        )}
        {message && <span className="ay-college__message">{message}</span>}
      </div>

      {!archive && (
        <div className="ay-college__actions">
          <Button type="button" variant="outlined" onClick={handleDownload} disabled={busy}>
            {busy && !confirmOpen ? "Preparing…" : "Download data"}
          </Button>
          {canDelete && year.status === "closed" && exportInfo && (
            <Button
              type="button"
              variant="outlined"
              className="ay-college__delete"
              onClick={() => setConfirmOpen(true)}
              disabled={busy}
            >
              Delete data
            </Button>
          )}
        </div>
      )}

      {confirmOpen && (
        <Modal title={`Delete ${collegeName} — ${year.label}`} onClose={() => setConfirmOpen(false)}>
          <div className="ay-college__confirm">
            <p>
              This permanently deletes every session, feedback, SSI result and event of <strong>{collegeName}</strong>{" "}
              for <strong>{year.label}</strong> ({formatDateDMY(year.startDate)} – {formatDateDMY(year.endDate)}). Other
              colleges are not touched. A small summary is kept.
            </p>
            <p>
              Make sure you have kept the downloaded files. Type <strong>{expected}</strong> to confirm.
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={expected}
              autoFocus
            />
            <div className="ay-college__confirm-actions">
              <Button type="button" variant="outlined" onClick={() => setConfirmOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="button" onClick={handleDelete} disabled={busy || confirmText.trim() !== expected}>
                {busy ? "Deleting…" : "Delete permanently"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
