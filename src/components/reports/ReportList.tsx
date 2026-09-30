import {
  FolderOpenIcon,
  CalendarIcon,
  UserIcon,
  ClockIcon,
  DownloadIcon,
  RefreshIcon,
  TrashIcon,
  CheckIcon,
  HourglassIcon,
} from "../common/icons";
import "./ReportList.css";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthLabel(m: number) {
  return MONTHS[(m - 1 + 12) % 12];
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export interface ReportListItem {
  id: string;
  title: string;
  month: number;
  year: number;
  uploadedBy: string;
  uploadedAt: string;
  fileName: string;
  downloadURL: string;
  status?: "pending" | "verified";
}

export interface ReportListProps<T extends ReportListItem> {
  title: string;
  reports: T[];
  loading?: boolean;
  emptyMessage: string;
  /** Hide when every row is always "you" (the viewer's own submissions). */
  showUploader?: boolean;
  onRefresh?: () => void;
  onDelete?: (report: T) => void;
  deletingId?: string | null;
  /** Shown as a "Verify" button on pending rows — the verifier's own action. */
  onVerify?: (report: T) => void;
  verifyingId?: string | null;
}

/** Read-only (+ optional verify/delete) list of uploaded reports — shared by
    the counsellor's own history, the head's "from your counsellors" list,
    the head's own consolidated-report history, and Admin's view of those. */
export function ReportList<T extends ReportListItem>({
  title,
  reports,
  loading,
  emptyMessage,
  showUploader = true,
  onRefresh,
  onDelete,
  deletingId,
  onVerify,
  verifyingId,
}: ReportListProps<T>) {
  return (
    <div className="report-list-block">
      <div className="report-list-block__header">
        <h3 className="report-list-block__title">{title}</h3>
        {onRefresh && (
          <button type="button" className="report-list-block__refresh" onClick={onRefresh}>
            <RefreshIcon /> Refresh
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ color: "var(--neu-text-muted)", fontSize: 14 }}>Loading…</p>
      ) : reports.length === 0 ? (
        <div className="report-list-block__empty">
          <div className="report-list-block__empty-icon">
            <FolderOpenIcon strokeWidth={1.5} />
          </div>
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <div className="report-list-block__list">
          {reports.map((r) => (
            <div key={r.id} className="report-list-block__row">
              <div className="report-list-block__row-info">
                <span className="report-list-block__row-title">{r.title}</span>
                <div className="report-list-block__row-meta">
                  <span><CalendarIcon /> {monthLabel(r.month)} {r.year}</span>
                  {showUploader && <span><UserIcon /> {r.uploadedBy}</span>}
                  <span><ClockIcon /> Submitted {formatDate(r.uploadedAt)}</span>
                  <span><FolderOpenIcon /> {r.fileName}</span>
                </div>
              </div>
              <div className="report-list-block__row-actions">
                <span className="report-list-block__badge">{monthLabel(r.month)} {r.year}</span>
                {r.status && (
                  <span className={`report-list-block__status report-list-block__status--${r.status}`}>
                    {r.status === "verified" ? <><CheckIcon /> Verified</> : <><HourglassIcon /> Pending</>}
                  </span>
                )}
                <a
                  href={r.downloadURL}
                  download={r.fileName}
                  className="report-list-block__btn report-list-block__btn--download"
                >
                  <DownloadIcon /> Download
                </a>
                {onVerify && r.status === "pending" && (
                  <button
                    type="button"
                    className="report-list-block__btn report-list-block__btn--verify"
                    disabled={verifyingId === r.id}
                    onClick={() => onVerify(r)}
                  >
                    <CheckIcon /> {verifyingId === r.id ? "Verifying…" : "Verify"}
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    className="report-list-block__btn report-list-block__btn--danger"
                    disabled={deletingId === r.id}
                    onClick={() => onDelete(r)}
                  >
                    <TrashIcon /> {deletingId === r.id ? "Deleting…" : "Delete"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
