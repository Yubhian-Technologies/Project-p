import { useEffect, useState } from "react";
import { listMonthlyReports, type MonthlyReport } from "../../services/firebase/monthlyReports";
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
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState(0); // 0 = all
  const [filterYear, setFilterYear] = useState(0);   // 0 = all

  async function load() {
    setLoading(true);
    try {
      setReports(await listMonthlyReports());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = reports.filter((r) => {
    if (filterMonth && r.month !== filterMonth) return false;
    if (filterYear && r.year !== filterYear) return false;
    return true;
  });

  return (
    <div className="mrv-section">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="mrv-header">
        <div className="mrv-header__title-block">
          <div className="mrv-header__icon">📋</div>
          <div>
            <h2 className="mrv-header__title">Monthly Reports</h2>
            <p className="mrv-header__sub">Reports submitted by Department Heads</p>
          </div>
        </div>
        <button type="button" className="mrv-refresh-btn" onClick={load}>
          ↻ Refresh
        </button>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────── */}
      <div className="mrv-filters">
        <div className="mrv-filters__field">
          <label className="mrv-filters__label" htmlFor="mrv-filter-month">Month</label>
          <select
            id="mrv-filter-month"
            className="mrv-filters__select"
            value={filterMonth}
            onChange={(e) => setFilterMonth(Number(e.target.value))}
          >
            <option value={0}>All months</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>

        <div className="mrv-filters__field">
          <label className="mrv-filters__label" htmlFor="mrv-filter-year">Year</label>
          <select
            id="mrv-filter-year"
            className="mrv-filters__select"
            value={filterYear}
            onChange={(e) => setFilterYear(Number(e.target.value))}
          >
            <option value={0}>All years</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {(filterMonth !== 0 || filterYear !== 0) && (
          <button
            type="button"
            className="mrv-filters__clear"
            onClick={() => { setFilterMonth(0); setFilterYear(0); }}
          >
            ✕ Clear filters
          </button>
        )}

        <span className="mrv-filters__count">
          {loading ? "Loading…" : `${filtered.length} report${filtered.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* ── List ────────────────────────────────────────────────────── */}
      {loading ? (
        <p style={{ color: "var(--neu-text-muted)", fontSize: 14 }}>Loading reports…</p>
      ) : filtered.length === 0 ? (
        <div className="mrv-list__empty">
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <p>
            {reports.length === 0
              ? "No monthly reports have been uploaded yet."
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
                  <span className="mrv-list__row-meta-item">📅 {monthLabel(r.month)} {r.year}</span>
                  <span className="mrv-list__row-meta-item">👤 {r.uploadedBy}</span>
                  <span className="mrv-list__row-meta-item">🕒 Uploaded {formatDate(r.uploadedAt)}</span>
                  <span className="mrv-list__row-meta-item">📁 {r.fileName}</span>
                </div>
              </div>

              <div className="mrv-list__row-right">
                <span className="mrv-badge">
                  {monthLabel(r.month)} {r.year}
                </span>
                <span className="mrv-badge mrv-badge--green">
                  ✓ By Head
                </span>
                <a
                  href={r.downloadURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mrv-btn-download"
                >
                  ⬇ View / Download
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
