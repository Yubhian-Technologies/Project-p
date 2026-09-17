import { useEffect, useState } from "react";
import {
  listMonthlyReports,
  type MonthlyReport,
} from "../../services/firebase/monthlyReports";
import { listCampuses } from "../../services/firebase/campuses";
import { listColleges } from "../../services/firebase/colleges";
import type { Campus } from "../../types/campus";
import type { College } from "../../types/college";
import { Select } from "../../components/common/Select";
import {
  FolderOpenIcon,
  CalendarIcon,
  UserIcon,
  ClockIcon,
  DownloadIcon,
  RefreshIcon,
  XIcon,
  CheckIcon,
  BuildingIcon,
} from "../../components/common/icons";
import "./MonthlyReportsViewSection.css";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => THIS_YEAR - i);

function monthLabel(m: number) {
  return MONTHS[(m - 1 + 12) % 12];
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function MonthlyReportsViewSection() {
  // ── Campus / College state ────────────────────────────────────────
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [selectedCampusId, setSelectedCampusId] = useState("");
  const [selectedCollegeId, setSelectedCollegeId] = useState("");
  const [loadingMeta, setLoadingMeta] = useState(true);

  // ── Reports state ────────────────────────────────────────────────
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterMonth, setFilterMonth] = useState(0);
  const [filterYear, setFilterYear] = useState(0);

  // ── Load campuses once on mount ──────────────────────────────────
  useEffect(() => {
    setLoadingMeta(true);
    listCampuses()
      .then(setCampuses)
      .finally(() => setLoadingMeta(false));
  }, []);

  // ── When campus changes, load its colleges & reset selection ─────
  useEffect(() => {
    setSelectedCollegeId("");
    setColleges([]);
    setReports([]);
    if (!selectedCampusId) return;
    listColleges(selectedCampusId).then(setColleges);
  }, [selectedCampusId]);

  // ── When college changes, fetch reports ──────────────────────────
  useEffect(() => {
    setReports([]);
    if (!selectedCampusId || !selectedCollegeId) return;
    loadReports();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCollegeId]);

  async function loadReports() {
    if (!selectedCampusId || !selectedCollegeId) return;
    setLoading(true);
    try {
      // Fetch all reports and filter client-side — avoids needing a
      // Firestore composite index on (campusId, collegeId, uploadedAt).
      const all = await listMonthlyReports();
      setReports(
        all.filter(
          (r) => r.campusId === selectedCampusId && r.collegeId === selectedCollegeId,
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  const filtered = reports.filter((r) => {
    if (filterMonth && r.month !== filterMonth) return false;
    if (filterYear && r.year !== filterYear) return false;
    return true;
  });

  const hasSelection = !!selectedCampusId && !!selectedCollegeId;

  return (
    <div className="mrv-section">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="mrv-header">
        <div className="mrv-header__title-block">
          <div className="mrv-header__icon">
            <FolderOpenIcon />
          </div>
          <div>
            <h2 className="mrv-header__title">Monthly Reports</h2>
            <p className="mrv-header__sub">Reports submitted by Department Heads</p>
          </div>
        </div>
        {hasSelection && (
          <button type="button" className="mrv-refresh-btn" onClick={loadReports}>
            <RefreshIcon /> Refresh
          </button>
        )}
      </div>

      {/* ── Campus / College selector card ──────────────────────────── */}
      <div className="mrv-selector-card">
        <div className="mrv-selector-card__row">
          {/* Campus */}
          <div className="mrv-filters__field">
            <label className="mrv-filters__label" htmlFor="mrv-campus">
              <BuildingIcon /> Campus
            </label>
            <Select
              id="mrv-campus"
              value={selectedCampusId}
              onChange={(v) => setSelectedCampusId(v)}
            >
              <option value="">— Select campus —</option>
              {loadingMeta ? (
                <option disabled>Loading…</option>
              ) : (
                campuses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))
              )}
            </Select>
          </div>

          {/* College — only enabled once a campus is picked */}
          <div className="mrv-filters__field">
            <label className="mrv-filters__label" htmlFor="mrv-college">
              <BuildingIcon /> College
            </label>
            <Select
              id="mrv-college"
              value={selectedCollegeId}
              onChange={(v) => setSelectedCollegeId(v)}
            >
              <option value="">
                {!selectedCampusId ? "Select campus first" : "— Select college —"}
              </option>
              {colleges.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
        </div>

        {!hasSelection && (
          <p className="mrv-selector-card__hint">
            Select a campus and college above to view their monthly reports.
          </p>
        )}
      </div>

      {/* ── Month / Year filters — only shown once campus+college chosen ── */}
      {hasSelection && (
        <div className="mrv-filters">
          <div className="mrv-filters__field">
            <label className="mrv-filters__label" htmlFor="mrv-filter-month">Month</label>
            <Select
              id="mrv-filter-month"
              value={String(filterMonth)}
              onChange={(v) => setFilterMonth(Number(v))}
            >
              <option value="0">All months</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={String(i + 1)}>{m}</option>
              ))}
            </Select>
          </div>

          <div className="mrv-filters__field">
            <label className="mrv-filters__label" htmlFor="mrv-filter-year">Year</label>
            <Select
              id="mrv-filter-year"
              value={String(filterYear)}
              onChange={(v) => setFilterYear(Number(v))}
            >
              <option value="0">All years</option>
              {YEARS.map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </Select>
          </div>

          {(filterMonth !== 0 || filterYear !== 0) && (
            <button
              type="button"
              className="mrv-filters__clear"
              onClick={() => { setFilterMonth(0); setFilterYear(0); }}
            >
              <XIcon /> Clear filters
            </button>
          )}

          <span className="mrv-filters__count">
            {loading ? "Loading…" : `${filtered.length} report${filtered.length !== 1 ? "s" : ""}`}
          </span>
        </div>
      )}

      {/* ── List ─────────────────────────────────────────────────────── */}
      {hasSelection && (
        loading ? (
          <p style={{ color: "var(--neu-text-muted)", fontSize: 14 }}>Loading reports…</p>
        ) : filtered.length === 0 ? (
          <div className="mrv-list__empty">
            <div className="mrv-list__empty-icon">
              <FolderOpenIcon strokeWidth={1.5} />
            </div>
            <p>
              {reports.length === 0
                ? "No monthly reports have been uploaded for this college yet."
                : "No reports match the selected filters."}
            </p>
          </div>
        ) : (
          <div className="mrv-list">
            {filtered.map((r) => (
              <div key={r.id} className="mrv-list__row">
                <div className="mrv-list__row-left">
                  <span className="mrv-list__row-title">{r.title}</span>
                  <div className="mrv-list__row-meta">
                    <span className="mrv-list__row-meta-item"><CalendarIcon /> {monthLabel(r.month)} {r.year}</span>
                    <span className="mrv-list__row-meta-item"><UserIcon /> {r.uploadedBy}</span>
                    <span className="mrv-list__row-meta-item"><ClockIcon /> Uploaded {formatDate(r.uploadedAt)}</span>
                    <span className="mrv-list__row-meta-item"><FolderOpenIcon /> {r.fileName}</span>
                  </div>
                </div>

                <div className="mrv-list__row-right">
                  <span className="mrv-badge">
                    {monthLabel(r.month)} {r.year}
                  </span>
                  <span className="mrv-badge mrv-badge--green">
                    <CheckIcon /> By Head
                  </span>
                  <a
                    href={r.downloadURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mrv-btn-download"
                  >
                    <DownloadIcon /> View / Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
