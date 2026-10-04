import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  listWorksheetAcademicYears,
  createWorksheetAcademicYear,
  deleteWorksheetAcademicYear,
  listWorksheets,
  createWorksheet,
  deleteWorksheet,
  listWorksheetRows,
  addWorksheetRow,
  updateWorksheetRow,
  deleteWorksheetRow,
  toggleWorksheetRowStatus,
} from "../../services/firebase/worksheets";
import { listBookableProfiles } from "../../services/firebase/bookings";
import type { WorksheetAcademicYear, Worksheet, WorksheetRow, WorksheetRowStatus } from "../../types/worksheet";
import type { UserProfile } from "../../types/user";
import { Card } from "../common/Card";
import { Button } from "../common/Button";
import { Select } from "../common/Select";
import "./CounsellorWorksheetSection.css";

const STATUS_LABELS: Record<WorksheetRowStatus, string> = {
  pending: "Pending",
  "in-progress": "In Progress",
  done: "Done",
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Campus-wide, Head-designed L&D/training schedule grid. Every counsellor
    and the Head on that campus can view it; a counsellor may only flip the
    status on the row that names them. */
export function CounsellorWorksheetSection() {
  const { currentUser, profile } = useAuth();
  const isHead = profile?.role === "head";
  const campusId = profile?.campusId;

  const [years, setYears] = useState<WorksheetAcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState("");
  const [addingYear, setAddingYear] = useState(false);
  const [newYearLabel, setNewYearLabel] = useState("");

  const [worksheetsList, setWorksheetsList] = useState<Worksheet[]>([]);
  const [selectedWorksheetId, setSelectedWorksheetId] = useState("");
  const [addingWorksheet, setAddingWorksheet] = useState(false);
  const [newWorksheetName, setNewWorksheetName] = useState("");

  const [rows, setRows] = useState<WorksheetRow[]>([]);
  const [counsellors, setCounsellors] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [worksheetAddFailed, setWorksheetAddFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const [newRow, setNewRow] = useState({ counsellorId: "", month: "", topic: "", dates: "", time: "" });

  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ counsellorId: "", month: "", topic: "", dates: "", time: "" });

  useEffect(() => {
    if (!campusId) {
      setLoading(false);
      return;
    }
    listWorksheetAcademicYears(campusId).then((list) => {
      setYears(list);
      setLoading(false);
    });
  }, [campusId]);

  useEffect(() => {
    if (!campusId || !selectedYearId) {
      setWorksheetsList([]);
      setSelectedWorksheetId("");
      return;
    }
    listWorksheets(campusId, selectedYearId).then(setWorksheetsList);
  }, [campusId, selectedYearId]);

  useEffect(() => {
    setEditingRowId(null);
    if (!campusId || !selectedWorksheetId) {
      setRows([]);
      return;
    }
    listWorksheetRows(selectedWorksheetId, campusId).then(setRows);
  }, [campusId, selectedWorksheetId]);

  useEffect(() => {
    if (!campusId || !isHead) return;
    listBookableProfiles().then((all) => {
      // Includes the Head themselves — they run sessions too and should be
      // assignable on a row, not just the counsellors under them.
      setCounsellors(all.filter((p) => p.campusId === campusId && (p.role === "counsellor" || p.role === "head")));
    });
  }, [campusId, isHead]);

  async function reloadRows() {
    if (!campusId || !selectedWorksheetId) return;
    setRows(await listWorksheetRows(selectedWorksheetId, campusId));
  }

  async function handleAddYear() {
    if (!campusId || !currentUser || !newYearLabel.trim()) return;
    setBusy(true);
    setError("");
    try {
      const id = await createWorksheetAcademicYear(campusId, newYearLabel.trim(), currentUser.uid);
      setNewYearLabel("");
      setAddingYear(false);
      setYears(await listWorksheetAcademicYears(campusId));
      setSelectedYearId(id);
    } catch (err) {
      console.error("Failed to add academic year:", err);
      setError("Couldn't add that academic year. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteYear(year: WorksheetAcademicYear) {
    if (!campusId) return;
    if (!window.confirm(`Delete "${year.label}" and every worksheet inside it? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await deleteWorksheetAcademicYear(year.id, campusId);
      setSelectedYearId("");
      setYears(await listWorksheetAcademicYears(campusId));
    } catch (err) {
      console.error("Failed to delete academic year:", err);
      setError("Couldn't delete that academic year. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddWorksheet() {
    if (!campusId || !currentUser || !selectedYearId || !newWorksheetName.trim()) return;
    setBusy(true);
    setError("");
    setWorksheetAddFailed(false);
    try {
      const id = await createWorksheet(campusId, selectedYearId, newWorksheetName.trim(), currentUser.uid);
      setNewWorksheetName("");
      setAddingWorksheet(false);
      setWorksheetsList(await listWorksheets(campusId, selectedYearId));
      setSelectedWorksheetId(id);
    } catch (err) {
      console.error("Failed to add worksheet:", err);
      setError("Couldn't add that worksheet.");
      setWorksheetAddFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteWorksheet(worksheet: Worksheet) {
    if (!campusId || !selectedYearId) return;
    if (!window.confirm(`Delete "${worksheet.name}" and all its rows? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await deleteWorksheet(worksheet.id, campusId);
      setSelectedWorksheetId("");
      setWorksheetsList(await listWorksheets(campusId, selectedYearId));
    } catch (err) {
      console.error("Failed to delete worksheet:", err);
      setError("Couldn't delete that worksheet. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddRow() {
    if (!campusId || !currentUser || !selectedWorksheetId) return;
    const counsellor = counsellors.find((c) => c.uid === newRow.counsellorId);
    if (!counsellor || !newRow.month.trim() || !newRow.topic.trim() || !newRow.dates.trim() || !newRow.time.trim()) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await addWorksheetRow(
        selectedWorksheetId,
        campusId,
        {
          counsellorId: counsellor.uid,
          counsellorName: counsellor.displayName || counsellor.email,
          month: newRow.month.trim(),
          topic: newRow.topic.trim(),
          dates: newRow.dates.trim(),
          time: newRow.time.trim(),
        },
        currentUser.uid,
      );
      setNewRow({ counsellorId: "", month: "", topic: "", dates: "", time: "" });
      await reloadRows();
    } catch (err) {
      console.error("Failed to add worksheet row:", err);
      setError("Couldn't add that row. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function handleStartEditRow(row: WorksheetRow) {
    setEditingRowId(row.id);
    setEditDraft({
      counsellorId: row.counsellorId,
      month: row.month,
      topic: row.topic,
      dates: row.dates,
      time: row.time,
    });
    setError("");
  }

  async function handleSaveEditRow() {
    if (!selectedWorksheetId || !editingRowId) return;
    const counsellor = counsellors.find((c) => c.uid === editDraft.counsellorId);
    if (!counsellor || !editDraft.month.trim() || !editDraft.topic.trim() || !editDraft.dates.trim() || !editDraft.time.trim()) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await updateWorksheetRow(selectedWorksheetId, editingRowId, {
        counsellorId: counsellor.uid,
        counsellorName: counsellor.displayName || counsellor.email,
        month: editDraft.month.trim(),
        topic: editDraft.topic.trim(),
        dates: editDraft.dates.trim(),
        time: editDraft.time.trim(),
      });
      setEditingRowId(null);
      await reloadRows();
    } catch (err) {
      console.error("Failed to update worksheet row:", err);
      setError("Couldn't save that row. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteRow(row: WorksheetRow) {
    if (!selectedWorksheetId) return;
    if (!window.confirm("Delete this row?")) return;
    setBusy(true);
    try {
      await deleteWorksheetRow(selectedWorksheetId, row.id);
      await reloadRows();
    } catch (err) {
      console.error("Failed to delete worksheet row:", err);
      setError("Couldn't delete that row. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleStatus(row: WorksheetRow, status: WorksheetRowStatus) {
    if (!selectedWorksheetId) return;
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status } : r)));
    try {
      await toggleWorksheetRowStatus(selectedWorksheetId, row.id, status);
    } catch (err) {
      console.error("Failed to update worksheet row status:", err);
      setError("Couldn't update that status. Please try again.");
      await reloadRows();
    }
  }

  if (loading) return null;

  if (!campusId) {
    return <p style={{ color: "var(--neu-text-muted)", fontSize: 14 }}>Your profile isn't linked to a campus yet.</p>;
  }

  const selectedYear = years.find((y) => y.id === selectedYearId);
  const selectedWorksheet = worksheetsList.find((w) => w.id === selectedWorksheetId);

  // ----- State C: open worksheet grid -----
  if (selectedYear && selectedWorksheet) {
    return (
      <div className="counsellor-worksheet">
        {error && <p className="counsellor-worksheet__error">{error}</p>}
        <button type="button" className="counsellor-worksheet__back" onClick={() => setSelectedWorksheetId("")}>
          ← Back to worksheets
        </button>

        <div className="counsellor-worksheet__table-wrap">
          <table className="counsellor-worksheet__table">
            <thead>
              <tr>
                <th colSpan={6} className="counsellor-worksheet__title-bar">
                  {selectedWorksheet.name} — {selectedYear.label}
                </th>
              </tr>
              <tr>
                <th>Name of Counsellor</th>
                <th>Month</th>
                <th>Topic</th>
                <th>Dates</th>
                <th>Time</th>
                <th>Session Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="counsellor-worksheet__empty">
                    No rows yet{isHead ? " — add the first one below." : "."}
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                const canToggle = isHead || row.counsellorId === currentUser?.uid;

                if (editingRowId === row.id) {
                  return (
                    <tr key={row.id}>
                      <td>
                        <Select
                          value={editDraft.counsellorId}
                          onChange={(v) => setEditDraft((d) => ({ ...d, counsellorId: v }))}
                        >
                          <option value="" disabled>
                            Select counsellor…
                          </option>
                          {counsellors.map((c) => (
                            <option key={c.uid} value={c.uid}>
                              {c.displayName || c.email}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td>
                        <Select value={editDraft.month} onChange={(v) => setEditDraft((d) => ({ ...d, month: v }))}>
                          <option value="" disabled>
                            Select month…
                          </option>
                          {MONTHS.map((month) => (
                            <option key={month} value={month}>
                              {month}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={editDraft.topic}
                          onChange={(e) => setEditDraft((d) => ({ ...d, topic: e.target.value }))}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={editDraft.dates}
                          onChange={(e) =>
                            setEditDraft((d) => ({ ...d, dates: e.target.value.replace(/[^0-9,\- ]/g, "") }))
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={editDraft.time}
                          onChange={(e) => setEditDraft((d) => ({ ...d, time: e.target.value }))}
                        />
                      </td>
                      <td>
                        <div className="counsellor-worksheet__status-cell">
                          <Button type="button" disabled={busy} onClick={handleSaveEditRow}>
                            {busy ? "Saving…" : "Save"}
                          </Button>
                          <Button
                            type="button"
                            variant="outlined"
                            disabled={busy}
                            onClick={() => setEditingRowId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={row.id}>
                    <td>{row.counsellorName}</td>
                    <td>{row.month}</td>
                    <td>{row.topic}</td>
                    <td>{row.dates}</td>
                    <td>{row.time}</td>
                    <td>
                      <div className="counsellor-worksheet__status-cell">
                        <span className={`counsellor-worksheet__badge counsellor-worksheet__badge--${row.status}`}>
                          {STATUS_LABELS[row.status]}
                        </span>
                        {canToggle && (
                          <Select value={row.status} onChange={(v) => handleToggleStatus(row, v as WorksheetRowStatus)}>
                            <option value="pending">Pending</option>
                            <option value="in-progress">In Progress</option>
                            <option value="done">Done</option>
                          </Select>
                        )}
                        {isHead && (
                          <>
                            <button
                              type="button"
                              className="counsellor-worksheet__row-edit"
                              aria-label="Edit row"
                              onClick={() => handleStartEditRow(row)}
                            >
                              ✎
                            </button>
                            <button
                              type="button"
                              className="counsellor-worksheet__row-delete"
                              aria-label="Delete row"
                              onClick={() => handleDeleteRow(row)}
                            >
                              ✕
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {isHead && (
          <Card className="counsellor-worksheet__add-row">
            <p className="counsellor-worksheet__add-row-title">Add a row</p>
            <div className="counsellor-worksheet__add-row-fields">
              <Select value={newRow.counsellorId} onChange={(v) => setNewRow((r) => ({ ...r, counsellorId: v }))}>
                <option value="" disabled>
                  Select counsellor…
                </option>
                {counsellors.map((c) => (
                  <option key={c.uid} value={c.uid}>
                    {c.displayName || c.email}
                  </option>
                ))}
              </Select>
              <Select value={newRow.month} onChange={(v) => setNewRow((r) => ({ ...r, month: v }))}>
                <option value="" disabled>
                  Select month…
                </option>
                {MONTHS.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </Select>
              <input
                type="text"
                placeholder="Topic"
                value={newRow.topic}
                onChange={(e) => setNewRow((r) => ({ ...r, topic: e.target.value }))}
              />
              <input
                type="text"
                inputMode="numeric"
                placeholder="Dates (e.g. 23-24 or 25)"
                value={newRow.dates}
                onChange={(e) => {
                  // Numbers only — plus "-" and "," so a range or list of dates
                  // (e.g. "23-24", "25, 26") can still be entered, no letters.
                  const digitsOnly = e.target.value.replace(/[^0-9,\- ]/g, "");
                  setNewRow((r) => ({ ...r, dates: digitsOnly }));
                }}
              />
              <input
                type="text"
                placeholder="Time"
                value={newRow.time}
                onChange={(e) => setNewRow((r) => ({ ...r, time: e.target.value }))}
              />
              <Button type="button" disabled={busy} onClick={handleAddRow}>
                {busy ? "Adding…" : "Add Row"}
              </Button>
            </div>
          </Card>
        )}
      </div>
    );
  }

  // ----- State B: worksheet list for selected year -----
  if (selectedYear) {
    return (
      <div className="counsellor-worksheet">
        {error && <p className="counsellor-worksheet__error">{error}</p>}
        <div className="counsellor-worksheet__year-header">
          <button type="button" className="counsellor-worksheet__back" onClick={() => setSelectedYearId("")}>
            ← Back to academic years
          </button>
          {isHead && (
            <button
              type="button"
              className="counsellor-worksheet__delete-year"
              onClick={() => handleDeleteYear(selectedYear)}
            >
              Delete academic year
            </button>
          )}
        </div>
        <p className="counsellor-worksheet__intro">Worksheets in {selectedYear.label}</p>

        <div className="counsellor-worksheet__list">
          {worksheetsList.length === 0 && <p>No worksheets yet{isHead ? " — add the first one below." : "."}</p>}
          {worksheetsList.map((w) => (
            <Card key={w.id} className="counsellor-worksheet__list-row">
              <button
                type="button"
                className="counsellor-worksheet__list-row-name"
                onClick={() => setSelectedWorksheetId(w.id)}
              >
                {w.name}
              </button>
              {isHead && (
                <button
                  type="button"
                  className="counsellor-worksheet__row-delete"
                  aria-label="Delete worksheet"
                  onClick={() => handleDeleteWorksheet(w)}
                >
                  ✕
                </button>
              )}
            </Card>
          ))}
        </div>

        {isHead && (
          <div className="counsellor-worksheet__add-inline">
            {addingWorksheet ? (
              <>
                <input
                  type="text"
                  placeholder="Worksheet name (e.g. Learning & Development Session)"
                  value={newWorksheetName}
                  onChange={(e) => setNewWorksheetName(e.target.value)}
                  autoFocus
                />
                <Button type="button" disabled={busy || !newWorksheetName.trim()} onClick={handleAddWorksheet}>
                  {busy ? "Adding…" : "Save"}
                </Button>
                {worksheetAddFailed && (
                  <Button type="button" variant="outlined" disabled={busy} onClick={handleAddWorksheet}>
                    Try Again
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outlined"
                  onClick={() => {
                    setAddingWorksheet(false);
                    setWorksheetAddFailed(false);
                    setError("");
                  }}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                type="button"
                onClick={() => {
                  setAddingWorksheet(true);
                  setWorksheetAddFailed(false);
                  setError("");
                }}
              >
                + Add Worksheet
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ----- State A: academic year picker -----
  return (
    <div className="counsellor-worksheet">
      {error && <p className="counsellor-worksheet__error">{error}</p>}
      <p className="counsellor-worksheet__intro">
        Pick an academic year to view its counsellor worksheets{isHead ? ", or add a new one." : "."}
      </p>

      <div className="counsellor-worksheet__year-row">
        <Select value={selectedYearId} onChange={setSelectedYearId} disabled={years.length === 0}>
          <option value="" disabled>
            {years.length === 0 ? "No academic years yet" : "Select academic year…"}
          </option>
          {years.map((y) => (
            <option key={y.id} value={y.id}>
              {y.label}
            </option>
          ))}
        </Select>
      </div>

      {isHead && (
        <div className="counsellor-worksheet__add-inline">
          {addingYear ? (
            <>
              <input
                type="text"
                placeholder="Academic year (e.g. 2026-2027)"
                value={newYearLabel}
                onChange={(e) => setNewYearLabel(e.target.value)}
                autoFocus
              />
              <Button type="button" disabled={busy || !newYearLabel.trim()} onClick={handleAddYear}>
                {busy ? "Adding…" : "Save"}
              </Button>
              <Button type="button" variant="outlined" onClick={() => setAddingYear(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button type="button" onClick={() => setAddingYear(true)}>
              + Add Academic Year
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
