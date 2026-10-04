import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { listBookableProfiles } from "../../services/firebase/bookings";
import {
  addWorkloadRow,
  deleteWorkloadRow,
  listWorkloadRows,
  setWorkloadRowStatus,
  updateWorkloadRow,
  type WorkloadRowInput,
} from "../../services/firebase/workloadSheets";
import {
  WORKLOAD_GROUP_LABELS,
  type WorkloadFeedback,
  type WorkloadGroup,
  type WorkloadRow,
} from "../../types/workloadSheet";
import type { WorksheetRowStatus } from "../../types/worksheet";
import { downloadCsv } from "../../utils/csvExport";
import { Button } from "../common/Button";
import { Select } from "../common/Select";
import "./TeamWorkloadSection.css";

const GROUPS: WorkloadGroup[] = ["compulsory", "optional", "action"];

const STATUS_LABELS: Record<WorksheetRowStatus, string> = {
  pending: "Pending",
  "in-progress": "In-Process",
  done: "Done",
};

interface DraftFields {
  topic: string;
  timelineMonth: string;
  sessionDates: string;
  durationMinutes: string;
  attendance: string;
  feedback: string;
}

const EMPTY_DRAFT: DraftFields = {
  topic: "",
  timelineMonth: "",
  sessionDates: "",
  durationMinutes: "",
  attendance: "",
  feedback: "",
};

function toNumberOrNull(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toFeedbackOrNull(value: string): WorkloadFeedback | null {
  return value === "yes" || value === "no" ? value : null;
}

function draftFromRow(row: WorkloadRow): DraftFields {
  return {
    topic: row.topic,
    timelineMonth: row.timelineMonth,
    sessionDates: row.sessionDates,
    durationMinutes: row.durationMinutes?.toString() ?? "",
    attendance: row.attendance?.toString() ?? "",
    feedback: row.feedback ?? "",
  };
}

function inputFromDraft(draft: DraftFields, group: WorkloadGroup): WorkloadRowInput {
  return {
    group,
    topic: draft.topic.trim(),
    timelineMonth: draft.timelineMonth.trim(),
    sessionDates: draft.sessionDates.trim(),
    durationMinutes: toNumberOrNull(draft.durationMinutes),
    attendance: toNumberOrNull(draft.attendance),
    feedback: toFeedbackOrNull(draft.feedback),
  };
}

interface Person {
  uid: string;
  name: string;
}

export function TeamWorkloadSection() {
  const { currentUser, profile } = useAuth();
  const campusId = profile?.campusId;
  const isHead = profile?.role === "head";
  const selfUid = currentUser?.uid ?? "";
  const selfName = profile?.displayName || profile?.email || "Me";

  const [people, setPeople] = useState<Person[]>([]);
  const [ownerUid, setOwnerUid] = useState("");
  const [rows, setRows] = useState<WorkloadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftFields>(EMPTY_DRAFT);
  const [newDrafts, setNewDrafts] = useState<Record<WorkloadGroup, DraftFields>>({
    compulsory: EMPTY_DRAFT,
    optional: EMPTY_DRAFT,
    action: EMPTY_DRAFT,
  });

  // Head: pick self or a counsellor on the campus. Counsellor: only themselves.
  useEffect(() => {
    if (!campusId || !selfUid) return;
    if (!isHead) {
      setPeople([{ uid: selfUid, name: selfName }]);
      setOwnerUid(selfUid);
      return;
    }
    listBookableProfiles().then((all) => {
      const list = all
        .filter((p) => p.campusId === campusId && (p.role === "counsellor" || p.role === "head"))
        .map((p) => ({ uid: p.uid, name: p.displayName || p.email }));
      const withSelf = list.some((p) => p.uid === selfUid) ? list : [{ uid: selfUid, name: selfName }, ...list];
      setPeople(withSelf);
      setOwnerUid((current) => current || selfUid);
    });
  }, [campusId, selfUid, selfName, isHead]);

  useEffect(() => {
    if (!campusId || !ownerUid) return;
    setLoading(true);
    listWorkloadRows(ownerUid, campusId)
      .then((list) => setRows(list))
      .catch((err) => {
        console.error("Failed to load workload rows:", err);
        setError("Couldn't load this workload sheet.");
      })
      .finally(() => setLoading(false));
  }, [campusId, ownerUid]);

  async function reload() {
    if (!campusId || !ownerUid) return;
    setRows(await listWorkloadRows(ownerUid, campusId));
  }

  function setNewDraft(group: WorkloadGroup, patch: Partial<DraftFields>) {
    setNewDrafts((prev) => ({ ...prev, [group]: { ...prev[group], ...patch } }));
  }

  async function handleAdd(group: WorkloadGroup) {
    const draft = newDrafts[group];
    if (!campusId || !currentUser || !ownerUid || !draft.topic.trim()) return;
    setBusy(true);
    setError("");
    try {
      await addWorkloadRow(ownerUid, campusId, inputFromDraft(draft, group), currentUser.uid, rows);
      setNewDraft(group, EMPTY_DRAFT);
      await reload();
    } catch (err) {
      console.error("Failed to add workload row:", err);
      setError("Couldn't add that row. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveEdit(row: WorkloadRow) {
    if (!ownerUid || !editDraft.topic.trim()) return;
    setBusy(true);
    setError("");
    try {
      await updateWorkloadRow(ownerUid, row.id, inputFromDraft(editDraft, row.group));
      setEditingId(null);
      await reload();
    } catch (err) {
      console.error("Failed to save workload row:", err);
      setError("Couldn't save that row. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleStatus(row: WorkloadRow, status: WorksheetRowStatus) {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status } : r)));
    try {
      await setWorkloadRowStatus(ownerUid, row.id, status);
    } catch (err) {
      console.error("Failed to update status:", err);
      setError("Couldn't update that status. Please try again.");
      await reload();
    }
  }

  async function handleDelete(row: WorkloadRow) {
    if (!window.confirm("Delete this row?")) return;
    setBusy(true);
    try {
      await deleteWorkloadRow(ownerUid, row.id);
      await reload();
    } catch (err) {
      console.error("Failed to delete workload row:", err);
      setError("Couldn't delete that row. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function handleDownload() {
    const ownerName = people.find((p) => p.uid === ownerUid)?.name ?? selfName;
    const headers = [
      "Owner",
      "Group",
      "Session Topic",
      "Timeline (Month)",
      "Session Date(s)",
      "Status",
      "Duration (min)",
      "Attendance",
      "Feedback",
    ];
    const body = GROUPS.flatMap((group) =>
      rows
        .filter((r) => r.group === group)
        .map((r) => [
          ownerName,
          WORKLOAD_GROUP_LABELS[group],
          r.topic,
          r.timelineMonth,
          r.sessionDates,
          STATUS_LABELS[r.status],
          r.durationMinutes ?? "",
          r.attendance ?? "",
          r.feedback ? (r.feedback === "yes" ? "Yes" : "No") : "",
        ]),
    );
    const safeName = ownerName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    downloadCsv(`workload-${safeName}.csv`, headers, body);
  }

  if (!campusId) {
    return <p className="twl-muted">Your profile isn't linked to a campus yet.</p>;
  }

  const ownerName = people.find((p) => p.uid === ownerUid)?.name ?? selfName;
  const canEditSheet = ownerUid === selfUid || isHead;
  const canEdit = (row: WorkloadRow) => row.ownerUid === selfUid || isHead;

  return (
    <div className="twl">
      <div className="twl-toolbar">
        <div>
          <p className="twl-label">Workload sheet</p>
          <h3 className="twl-title">{ownerName}</h3>
        </div>
        <div className="twl-toolbar__actions">
          {isHead && people.length > 1 && (
            <div className="twl-person">
              <Select value={ownerUid} onChange={setOwnerUid}>
                {people.map((p) => (
                  <option key={p.uid} value={p.uid}>
                    {p.uid === selfUid ? `${p.name} (you)` : p.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <Button type="button" variant="outlined" onClick={handleDownload} disabled={loading || rows.length === 0}>
            Download CSV
          </Button>
        </div>
      </div>

      {error && <p className="twl-error">{error}</p>}
      {loading && <p className="twl-muted">Loading sheet…</p>}

      {!loading &&
        GROUPS.map((group) => {
          const groupRows = rows.filter((r) => r.group === group);
          const draft = newDrafts[group];
          return (
            <section key={group} className="twl-group">
              <h4 className="twl-group__title">{WORKLOAD_GROUP_LABELS[group]}</h4>
              <div className="twl-table-wrap">
                <table className="twl-table">
                  <thead>
                    <tr>
                      <th>Session Topic</th>
                      <th>Timeline (Month)</th>
                      <th>Session Date(s)</th>
                      <th>Status</th>
                      <th>Duration (min)</th>
                      <th>Attendance</th>
                      <th>Feedback</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {groupRows.length === 0 && (
                      <tr>
                        <td colSpan={8} className="twl-empty">
                          No rows yet.
                        </td>
                      </tr>
                    )}
                    {groupRows.map((row) =>
                      editingId === row.id ? (
                        <tr key={row.id}>
                          <td>
                            <input value={editDraft.topic} onChange={(e) => setEditDraft({ ...editDraft, topic: e.target.value })} />
                          </td>
                          <td>
                            <input value={editDraft.timelineMonth} onChange={(e) => setEditDraft({ ...editDraft, timelineMonth: e.target.value })} />
                          </td>
                          <td>
                            <input value={editDraft.sessionDates} onChange={(e) => setEditDraft({ ...editDraft, sessionDates: e.target.value })} />
                          </td>
                          <td>{STATUS_LABELS[row.status]}</td>
                          <td>
                            <input inputMode="numeric" value={editDraft.durationMinutes} onChange={(e) => setEditDraft({ ...editDraft, durationMinutes: e.target.value })} />
                          </td>
                          <td>
                            <input inputMode="numeric" value={editDraft.attendance} onChange={(e) => setEditDraft({ ...editDraft, attendance: e.target.value })} />
                          </td>
                          <td>
                            <Select value={editDraft.feedback} onChange={(v) => setEditDraft({ ...editDraft, feedback: v })}>
                              <option value="">—</option>
                              <option value="yes">Yes</option>
                              <option value="no">No</option>
                            </Select>
                          </td>
                          <td>
                            <div className="twl-actions">
                              <Button type="button" disabled={busy} onClick={() => handleSaveEdit(row)}>Save</Button>
                              <Button type="button" variant="outlined" onClick={() => setEditingId(null)}>Cancel</Button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={row.id}>
                          <td>{row.topic}</td>
                          <td>{row.timelineMonth}</td>
                          <td>{row.sessionDates}</td>
                          <td>
                            <div className="twl-status">
                              <span className={`twl-badge twl-badge--${row.status}`}>{STATUS_LABELS[row.status]}</span>
                              {canEdit(row) && (
                                <Select value={row.status} onChange={(v) => handleStatus(row, v as WorksheetRowStatus)}>
                                  <option value="pending">Pending</option>
                                  <option value="in-progress">In-Process</option>
                                  <option value="done">Done</option>
                                </Select>
                              )}
                            </div>
                          </td>
                          <td>{row.durationMinutes ?? "—"}</td>
                          <td>{row.attendance ?? "—"}</td>
                          <td>{row.feedback ? (row.feedback === "yes" ? "Yes" : "No") : "—"}</td>
                          <td>
                            {canEdit(row) && (
                              <div className="twl-actions">
                                <button
                                  type="button"
                                  className="twl-icon"
                                  aria-label="Edit row"
                                  onClick={() => {
                                    setEditingId(row.id);
                                    setEditDraft(draftFromRow(row));
                                  }}
                                >
                                  ✎
                                </button>
                                <button type="button" className="twl-icon twl-icon--danger" aria-label="Delete row" onClick={() => handleDelete(row)}>
                                  ✕
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>

              {canEditSheet && (
                <div className="twl-add">
                  <input placeholder="Session topic" value={draft.topic} onChange={(e) => setNewDraft(group, { topic: e.target.value })} />
                  <input placeholder="Timeline (e.g. July-August)" value={draft.timelineMonth} onChange={(e) => setNewDraft(group, { timelineMonth: e.target.value })} />
                  <input placeholder="Session date(s)" value={draft.sessionDates} onChange={(e) => setNewDraft(group, { sessionDates: e.target.value })} />
                  <input placeholder="Duration (min)" inputMode="numeric" value={draft.durationMinutes} onChange={(e) => setNewDraft(group, { durationMinutes: e.target.value })} />
                  <input placeholder="Attendance" inputMode="numeric" value={draft.attendance} onChange={(e) => setNewDraft(group, { attendance: e.target.value })} />
                  <Select value={draft.feedback} onChange={(v) => setNewDraft(group, { feedback: v })}>
                    <option value="">Feedback —</option>
                    <option value="yes">Feedback: Yes</option>
                    <option value="no">Feedback: No</option>
                  </Select>
                  <Button type="button" disabled={busy || !draft.topic.trim()} onClick={() => handleAdd(group)}>
                    {busy ? "Adding…" : "Add row"}
                  </Button>
                </div>
              )}
            </section>
          );
        })}
    </div>
  );
}
