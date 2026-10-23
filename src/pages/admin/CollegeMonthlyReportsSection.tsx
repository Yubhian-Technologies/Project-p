import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  listMonthlyStaffReportsForRecipient,
  type MonthlyStaffReport,
} from "../../services/firebase/counsellorMonthlyReports";
import "./CollegeMonthlyReportsSection.css";

const REPORT_MONTH_LABEL = (month: number, year: number) =>
  new Date(year, month - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });

export function CollegeMonthlyReportsSection() {
  const { profile } = useAuth();
  const [reports, setReports] = useState<MonthlyStaffReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const campusIds = profile?.adminAccess?.campusIds?.length
    ? profile.adminAccess.campusIds
    : profile?.campusId
      ? [profile.campusId]
      : [];
  const collegeIds = profile?.adminAccess?.collegeIds?.length
    ? profile.adminAccess.collegeIds
    : profile?.collegeId
      ? [profile.collegeId]
      : [];
  const scopeKey = `${campusIds.join(",")}|${collegeIds.join(",")}`;
  const [campusKey, collegeKey] = scopeKey.split("|");
  const scopes = useMemo(
    () => campusKey && collegeKey
      ? campusKey.split(",").flatMap((campusId) =>
          collegeKey.split(",").map((collegeId) => ({ campusId, collegeId })),
        )
      : [],
    [campusKey, collegeKey],
  );

  useEffect(() => {
    let active = true;
    if (!profile?.uid) {
      setReports([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    listMonthlyStaffReportsForRecipient(profile.uid, scopes)
      .then((items) => {
        if (active) {
          setReports(items);
          setError("");
        }
      })
      .catch((loadError: unknown) => {
        console.error("Failed to load college monthly reports:", loadError);
        if (active) setError("Couldn't load reports shared with your account. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [profile?.uid, scopes]);

  return (
    <section className="college-reports">
      <header className="college-reports__header">
        <div>
          <h2>Monthly Reports Shared With You</h2>
          <p>Reports from your assigned college(s), shared directly by a Head or Counsellor.</p>
        </div>
        <span className="college-reports__count">{reports.length} report{reports.length === 1 ? "" : "s"}</span>
      </header>

      {error && <p className="college-reports__error" role="alert">{error}</p>}
      {loading ? (
        <p className="college-reports__empty" role="status">Loading shared reports…</p>
      ) : reports.length === 0 ? (
        <p className="college-reports__empty">No monthly reports have been shared with your account yet.</p>
      ) : (
        <div className="college-reports__list">
          {reports.map((report) => (
            <article className="college-reports__item" key={report.id}>
              <div className="college-reports__details">
                <span className="college-reports__period">{REPORT_MONTH_LABEL(report.month, report.year)}</span>
                <h3>{report.title}</h3>
                <p>
                  {report.uploadedByRole === "head" ? "Head" : "Counsellor"} report · {report.uploadedBy}
                </p>
              </div>
              <a
                className="college-reports__download"
                href={report.downloadURL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${report.title}, ${REPORT_MONTH_LABEL(report.month, report.year)}`}
              >
                View report
                <span aria-hidden="true">↗</span>
              </a>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
