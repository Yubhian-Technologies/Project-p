import { useEffect, useState } from "react";
import { listCampuses } from "../../services/firebase/campuses";
import {
  listWorksheetAcademicYears,
  listWorksheets,
  listWorksheetRows,
} from "../../services/firebase/worksheets";
import type { WorksheetAcademicYear, Worksheet, WorksheetRow, WorksheetRowStatus } from "../../types/worksheet";
import type { Campus } from "../../types/campus";
import { Card } from "../../components/common/Card";
import { Select } from "../../components/common/Select";
import "./CounsellorWorksheetSection.css";

const STATUS_LABELS: Record<WorksheetRowStatus, string> = {
  pending: "Pending",
  "in-progress": "In Progress",
  done: "Done",
};

export function CounsellorWorksheetSection() {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [selectedCampusId, setSelectedCampusId] = useState("");
  const [years, setYears] = useState<WorksheetAcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState("");
  const [worksheetsList, setWorksheetsList] = useState<Worksheet[]>([]);
  const [selectedWorksheetId, setSelectedWorksheetId] = useState("");
  const [rows, setRows] = useState<WorksheetRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    listCampuses()
      .then((list) => {
        if (cancelled) return;
        setCampuses(list);
        if (list.length > 0 && !selectedCampusId) {
          setSelectedCampusId(list[0].id);
        }
      })
      .catch(() => setError("Couldn't load campuses. Please try again."));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setYears([]);
    setSelectedYearId("");
    setWorksheetsList([]);
    setSelectedWorksheetId("");
    setRows([]);
    if (!selectedCampusId) return;
    listWorksheetAcademicYears(selectedCampusId)
      .then((list) => {
        if (!cancelled) setYears(list);
      })
      .catch(() => setError("Couldn't load academic years for this campus."));
    return () => {
      cancelled = true;
    };
  }, [selectedCampusId]);

  useEffect(() => {
    let cancelled = false;
    setWorksheetsList([]);
    setSelectedWorksheetId("");
    setRows([]);
    if (!selectedCampusId || !selectedYearId) return;
    listWorksheets(selectedCampusId, selectedYearId)
      .then((list) => {
        if (!cancelled) setWorksheetsList(list);
      })
      .catch(() => setError("Couldn't load worksheets for this year."));
    return () => {
      cancelled = true;
    };
  }, [selectedCampusId, selectedYearId]);

  useEffect(() => {
    let cancelled = false;
    setRows([]);
    if (!selectedCampusId || !selectedWorksheetId) return;
    listWorksheetRows(selectedWorksheetId, selectedCampusId)
      .then((list) => {
        if (!cancelled) setRows(list);
      })
      .catch(() => setError("Couldn't load worksheet rows."));
    return () => {
      cancelled = true;
    };
  }, [selectedCampusId, selectedWorksheetId]);

  const selectedYear = years.find((y) => y.id === selectedYearId);
  const selectedWorksheet = worksheetsList.find((w) => w.id === selectedWorksheetId);
  const selectedCampus = campuses.find((c) => c.id === selectedCampusId);

  if (!selectedCampusId || !selectedYear) {
    return (
      <div className="counsellor-worksheet">
        {error && <p className="counsellor-worksheet__error">{error}</p>}
        <div className="counsellor-worksheet__filters">
          <div className="counsellor-worksheet__filter-field">
            <label htmlFor="worksheet-campus">Campus</label>
            <Select id="worksheet-campus" value={selectedCampusId} onChange={setSelectedCampusId}>
              <option value="" disabled>Select campus…</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div className="counsellor-worksheet__filter-field">
            <label htmlFor="worksheet-year">Academic Year</label>
            <Select
              id="worksheet-year"
              value={selectedYearId}
              onChange={setSelectedYearId}
              disabled={!selectedCampusId || years.length === 0}
            >
              <option value="" disabled>
                {!selectedCampusId
                  ? "Select campus first"
                  : years.length === 0
                  ? "No academic years yet"
                  : "Select academic year…"}
              </option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>{y.label}</option>
              ))}
            </Select>
          </div>
        </div>
        <p className="counsellor-worksheet__intro">
          Select a campus and academic year to view the counsellor worksheets.
        </p>
      </div>
    );
  }

  if (!selectedWorksheetId || !selectedWorksheet) {
    return (
      <div className="counsellor-worksheet">
        {error && <p className="counsellor-worksheet__error">{error}</p>}
        <div className="counsellor-worksheet__year-header">
          <div className="counsellor-worksheet__location">
            <span className="counsellor-worksheet__campus-badge">{selectedCampus?.name}</span>
            <span>→</span>
            <span>{selectedYear.label}</span>
          </div>
          <button type="button" className="counsellor-worksheet__back" onClick={() => setSelectedYearId("")}>
            ← Change campus/year
          </button>
        </div>
        <p className="counsellor-worksheet__intro">
          Worksheets in {selectedYear.label} for {selectedCampus?.name}
        </p>

        <div className="counsellor-worksheet__list">
          {worksheetsList.length === 0 && <p>No worksheets yet.</p>}
          {worksheetsList.map((w) => (
            <Card key={w.id} className="counsellor-worksheet__list-row">
              <button
                type="button"
                className="counsellor-worksheet__list-row-name"
                onClick={() => setSelectedWorksheetId(w.id)}
              >
                {w.name}
              </button>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="counsellor-worksheet">
      {error && <p className="counsellor-worksheet__error">{error}</p>}
      <div className="counsellor-worksheet__year-header">
        <div className="counsellor-worksheet__location">
          <span className="counsellor-worksheet__campus-badge">{selectedCampus?.name}</span>
          <span>→</span>
          <span>{selectedYear.label}</span>
          <span>→</span>
          <span>{selectedWorksheet.name}</span>
        </div>
        <button type="button" className="counsellor-worksheet__back" onClick={() => setSelectedWorksheetId("")}>
          ← Back to worksheets
        </button>
      </div>

      <div className="counsellor-worksheet__table-wrap">
        <table className="counsellor-worksheet__table">
          <thead>
            <tr>
              <th colSpan={6} className="counsellor-worksheet__title-bar">
                {selectedWorksheet.name} — {selectedYear.label} — {selectedCampus?.name}
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
                <td colSpan={6} className="counsellor-worksheet__empty">No rows yet.</td>
              </tr>
            )}
            {rows.map((row) => (
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
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
