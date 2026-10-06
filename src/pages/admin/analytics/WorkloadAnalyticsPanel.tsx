import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../services/firebase/config";
import { listCampuses } from "../../../services/firebase/campuses";
import { listBookableProfiles } from "../../../services/firebase/bookings";
import { listEventsForCampus } from "../../../services/firebase/events";
import { listWorkloadRows } from "../../../services/firebase/workloadSheets";
import { computeCampusWorkloadAnalytics, type CampusWorkloadAnalytics } from "../../head/workloadAnalytics";
import type { Campus } from "../../../types/campus";
import type { Booking } from "../../../types/booking";
import type { WorkloadRow } from "../../../types/workloadSheet";
import { Select } from "../../../components/common/Select";
import "./WorkloadAnalyticsPanel.css";

function fmt(value: number | null, suffix = "%"): string {
  return value === null ? "—" : `${value}${suffix}`;
}

export function WorkloadAnalyticsPanel() {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [campusId, setCampusId] = useState("");
  const [analytics, setAnalytics] = useState<CampusWorkloadAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listCampuses().then((list) => {
      setCampuses(list);
      setCampusId((current) => current || list[0]?.id || "");
    });
  }, []);

  useEffect(() => {
    if (!campusId) return;
    let active = true;
    setLoading(true);
    setError("");

    async function load() {
      try {
        const [events, bookingSnap, allProfiles] = await Promise.all([
          listEventsForCampus(campusId),
          getDocs(query(collection(db, "bookings"), where("campusId", "==", campusId))),
          listBookableProfiles(),
        ]);
        const people = allProfiles
          .filter((p) => p.campusId === campusId)
          .map((p) => ({ uid: p.uid, name: p.displayName || p.email, role: p.role }));
        const rowLists = await Promise.all(
          people.map((p) => listWorkloadRows(p.uid, campusId).catch(() => [] as WorkloadRow[])),
        );
        const rowsByOwner: Record<string, WorkloadRow[]> = {};
        people.forEach((p, i) => {
          rowsByOwner[p.uid] = rowLists[i];
        });
        const bookings = bookingSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Booking);
        if (!active) return;
        setAnalytics(
          computeCampusWorkloadAnalytics({ now: new Date(), events, bookings, people, rowsByOwner }),
        );
      } catch (err) {
        console.error("Failed to load workload analytics:", err);
        if (active) setError("Couldn't load analytics for this campus.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [campusId]);

  return (
    <div className="wla">
      <div className="wla-toolbar">
        <div>
          <p className="wla-label">Team workload analytics</p>
          <p className="wla-muted">Events, sessions, counsellor workload, and workload sheets per campus.</p>
        </div>
        <div className="wla-campus">
          <Select value={campusId} onChange={setCampusId} disabled={campuses.length === 0}>
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {error && <p className="wla-error">{error}</p>}
      {loading && <p className="wla-muted">Loading analytics…</p>}

      {analytics && !loading && (
        <>
          <section className="wla-cards">
            <Stat label="Events completed" value={`${analytics.events.completed} / ${analytics.events.total}`} note={`${analytics.events.upcoming} upcoming`} />
            <Stat label="Event completion" value={fmt(analytics.events.completionPct)} note="Of events whose date has passed" />
            <Stat label="Individual sessions" value={analytics.sessions.booked} note={`${analytics.sessions.missed} missed`} />
            <Stat label="Session completion" value={fmt(analytics.sessions.completionPct)} note="Completed of booked" />
            <Stat label="Group sessions" value={analytics.groupSessions.total} note={`${analytics.groupSessions.completed} completed`} />
            <Stat label="Sheet rows done" value={fmt(analytics.sheets.donePct)} note={`${analytics.sheets.totalRows} rows`} />
            <Stat label="Attendance recorded" value={analytics.sheets.totalAttendance} note={`Feedback yes ${fmt(analytics.sheets.feedbackYesPct)}`} />
          </section>

          <section className="wla-panel">
            <h3 className="wla-title">Counsellor &amp; Head workload</h3>
            {analytics.counsellorWorkload.length === 0 ? (
              <p className="wla-muted">No counsellors or heads on this campus.</p>
            ) : (
              <div className="wla-table-wrap">
                <table className="wla-table">
                  <thead>
                    <tr>
                      <th>Person</th>
                      <th>Upcoming</th>
                      <th>Pending</th>
                      <th>Group Sessions</th>
                      <th>Workload</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.counsellorWorkload.map((c) => (
                      <tr key={c.uid}>
                        <td>{c.name}</td>
                        <td>{c.upcoming}</td>
                        <td>{c.pending}</td>
                        <td>{c.groupSessions}</td>
                        <td>
                          <span className={`wla-pill wla-pill--${c.label.toLowerCase()}`}>{c.label}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="wla-panel">
            <h3 className="wla-title">Workload sheets by person</h3>
            <div className="wla-table-wrap">
              <table className="wla-table">
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>Rows</th>
                    <th>Done</th>
                    <th>Attendance</th>
                    <th>Feedback yes</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.sheets.people.map((p) => (
                    <tr key={p.uid}>
                      <td>{p.name}</td>
                      <td>{p.rows}</td>
                      <td>{fmt(p.donePct)}</td>
                      <td>{p.attendance}</td>
                      <td>{fmt(p.feedbackYesPct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: number | string; note: string }) {
  return (
    <div className="wla-stat">
      <p className="wla-stat__label">{label}</p>
      <p className="wla-stat__value">{value}</p>
      <p className="wla-stat__note">{note}</p>
    </div>
  );
}
