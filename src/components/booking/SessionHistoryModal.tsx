import { Modal } from "../common/Modal";
import { formatDateTimeDMY } from "../../utils/formatDate";
import "./SessionHistoryModal.css";

interface SessionHistoryEntry {
  scheduledAt?: number;
  summary?: string;
}

interface SessionHistoryModalProps {
  clientEmail: string;
  history: SessionHistoryEntry[];
  loading: boolean;
  onClose: () => void;
}

export function SessionHistoryModal({ clientEmail, history, loading, onClose }: SessionHistoryModalProps) {
  return (
    <Modal title={`Session History — ${clientEmail}`} onClose={onClose}>
      {loading ? (
        <p>Loading…</p>
      ) : history.length === 0 ? (
        <p>No prior sessions found.</p>
      ) : (
        <div className="session-history">
          {history.map((entry, index) => (
            <div key={index} className="session-history__entry">
              <p className="session-history__date">
                {entry.scheduledAt ? formatDateTimeDMY(entry.scheduledAt) : "Date not recorded"}
              </p>
              <p className="session-history__summary">{entry.summary || "No summary recorded"}</p>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
