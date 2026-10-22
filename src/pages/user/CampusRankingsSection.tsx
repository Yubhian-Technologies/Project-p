import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  getCampusStudentRankings,
  getAllCampusesTopStudents,
  type CampusStudentRanking,
  type CampusLeaderboardResult,
} from "../../services/campusRankings";
import { listCampuses } from "../../services/firebase/campuses";
import type { Campus } from "../../types/campus";
import { getWellnessData } from "../../services/wellnessScore";
import {
  TrophyIcon,
  FlameIcon,
  TrendingUpIcon,
  CheckIcon,
  BookOpenIcon,
  LotusIcon,
  StarIcon,
  BuildingIcon,
} from "../../components/common/icons";
import "./CampusRankingsSection.css";

interface CampusRankingsSectionProps {
  onSelectSection?: (sectionId: string) => void;
}

export function CampusRankingsSection({ onSelectSection }: CampusRankingsSectionProps) {
  const { profile } = useAuth();
  const [data, setData] = useState<CampusLeaderboardResult | null>(null);
  const [allCampusesData, setAllCampusesData] = useState<CampusLeaderboardResult[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [selectedCampusId, setSelectedCampusId] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [wellnessData, setWellnessData] = useState(getWellnessData());

  const isStaff = Boolean(profile?.role && profile.role !== "user");
  const isManagement =
    profile?.role === "super-admin" ||
    (profile?.role === "admin" &&
      (!profile.adminAccess ||
        profile.adminAccess.scope === "global" ||
        profile.adminAccess.designation === "management"));

  useEffect(() => {
    let isMounted = true;

    async function loadData(isInitial = false) {
      if (isInitial) setLoading(true);

      try {
        if (isManagement) {
          const [campusList, allResults] = await Promise.all([
            listCampuses().catch(() => []),
            getAllCampusesTopStudents().catch(() => []),
          ]);
          if (isMounted) {
            setCampuses(campusList);
            setAllCampusesData(allResults);
          }
        } else {
          // Regular user, Head, Counsellor, or non-management campus-scoped Admin
          const res = await getCampusStudentRankings(profile?.campusId, profile);
          if (isMounted) {
            setData(res);
            setWellnessData(getWellnessData());
          }
        }
      } catch (err) {
        console.error("Failed to load campus student rankings", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData(true);

    function handleUpdate() {
      loadData(false);
    }

    window.addEventListener("wellness_score_updated", handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener("wellness_score_updated", handleUpdate);
    };
  }, [profile?.campusId, profile?.uid, isManagement]);

  const students = data?.students || [];
  const campusName = data?.campusName || "Your Campus";
  const currentUserRanking = students.find((s) => s.isCurrentUser);
  const maxScore = students.length > 0 ? students[0].score : 1000;

  // Strictly Top 3 students for leaderboard display
  const top3Students = students.slice(0, 3);
  const showCurrentUserSeparately =
    !isStaff && currentUserRanking && currentUserRanking.rank > 3;

  function renderRankBadge(rank: number) {
    if (rank === 1) {
      return (
        <span className="cr-rank-badge cr-rank-badge--1" title="1st Place (Gold)">
          <TrophyIcon className="cr-rank-icon cr-rank-icon--gold" />
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="cr-rank-badge cr-rank-badge--2" title="2nd Place (Silver)">
          <TrophyIcon className="cr-rank-icon cr-rank-icon--silver" />
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="cr-rank-badge cr-rank-badge--3" title="3rd Place (Bronze)">
          <TrophyIcon className="cr-rank-icon cr-rank-icon--bronze" />
        </span>
      );
    }
    return (
      <span className="cr-rank-badge cr-rank-badge--other">
        #{rank}
      </span>
    );
  }

  function renderStudentRow(student: CampusStudentRanking, scoreCeiling = maxScore, showYouTag = true) {
    const pct = student.score > 0 ? Math.max(10, Math.round((student.score / scoreCeiling) * 100)) : 0;
    return (
      <tr key={student.uid} className={showYouTag && student.isCurrentUser ? "is-user-campus" : ""}>
        <td>{renderRankBadge(student.rank)}</td>
        <td>
          <div className="cr-campus-cell">
            <div>
              <strong className="cr-campus-title">{student.name}</strong>
              {(student.registerNumber || student.branch) && (
                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                  {student.registerNumber} {student.branch ? `• ${student.branch}` : ""}
                </div>
              )}
            </div>
            {showYouTag && student.isCurrentUser && <span className="cr-you-pill">You</span>}
          </div>
        </td>
        <td className="cr-score-cell">
          <div className="cr-score-val">{student.score.toLocaleString()} pts</div>
          <div className="cr-score-bar-bg">
            <div className="cr-score-bar-fill" style={{ width: `${pct}%` }} />
          </div>
        </td>
        <td>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontWeight: 700 }}>
            <FlameIcon className="cr-streak-flame" /> {student.streak}d
          </span>
        </td>
        <td>
          <span className="cr-badge-pill">{student.badge}</span>
        </td>
      </tr>
    );
  }

  function renderLeaderboardTable(
    topStudents: CampusStudentRanking[],
    tableCampusName: string,
    scoreCeiling: number,
    isStaffView: boolean,
  ) {
    return (
      <div className="cr-table-card" key={tableCampusName}>
        <div className="cr-section-header">
          <div>
            <h3 className="cr-section-title">
              <TrophyIcon /> {tableCampusName} Student Leaderboard
            </h3>
            <p className="cr-section-sub">
              {isStaffView
                ? `Top 3 student leaders leading this session at ${tableCampusName}`
                : `Top 3 leaders and your standing among enrolled peers at ${tableCampusName}`}
            </p>
          </div>
        </div>

        <div className="cr-table-responsive">
          <table className="cr-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Student</th>
                <th>Marks & Score</th>
                <th>Streak</th>
                <th>Honor Badge</th>
              </tr>
            </thead>
            <tbody>
              {topStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "28px", color: "#64748b" }}>
                    No students recorded yet on {tableCampusName}.
                  </td>
                </tr>
              ) : (
                topStudents.map((st) => renderStudentRow(st, scoreCeiling, !isStaffView))
              )}

              {!isStaffView && showCurrentUserSeparately && currentUserRanking && (
                <>
                  <tr className="cr-table-divider-row">
                    <td colSpan={5}>
                      <div className="cr-table-divider-line">
                        <span>• • • Your Standing • • •</span>
                      </div>
                    </td>
                  </tr>
                  {renderStudentRow(currentUserRanking, scoreCeiling, true)}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Management Admin / Super-Admin View: View All Campuses' Top 3 Members
  // ─────────────────────────────────────────────────────────────────────────────
  if (isManagement) {
    const displayedCampuses =
      selectedCampusId === "all"
        ? allCampusesData
        : allCampusesData.filter((c) => c.campusId === selectedCampusId);

    return (
      <div className="campus-rankings">
        {/* Management Hero Banner */}
        <div className="cr-hero">
          <div className="cr-hero__left">
            <span className="cr-hero__tag">
              <BuildingIcon /> All Campuses Oversight
            </span>
            <h2 className="cr-hero__title">Student Wellness Rankings</h2>
            <p className="cr-hero__sub">
              Top 3 student leaders across all enrolled Vishnu Educational Institutions campuses.
            </p>
          </div>

          <div className="cr-hero__user-card">
            <div className="cr-hero__user-card-label">Management Oversight</div>
            <div className="cr-hero__user-card-name">All Institutions</div>
            <div className="cr-hero__user-metrics">
              <div className="cr-hero__user-stat">
                <span className="cr-hero__user-stat-val">{campuses.length}</span>
                <span className="cr-hero__user-stat-lbl">Campuses</span>
              </div>
              <div className="cr-hero__user-stat">
                <span className="cr-hero__user-stat-val" style={{ color: "#34d399" }}>Top 3</span>
                <span className="cr-hero__user-stat-lbl">Per Campus</span>
              </div>
            </div>
          </div>
        </div>

        {/* Campus Filter Pills */}
        <div className="cr-campus-filter-bar">
          <button
            type="button"
            className={`cr-campus-filter-btn ${selectedCampusId === "all" ? "is-active" : ""}`}
            onClick={() => setSelectedCampusId("all")}
          >
            <BuildingIcon /> All Campuses ({campuses.length})
          </button>
          {campuses.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`cr-campus-filter-btn ${selectedCampusId === c.id ? "is-active" : ""}`}
              onClick={() => setSelectedCampusId(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#64748b" }}>
            Loading top students across all campuses…
          </div>
        ) : (
          displayedCampuses.map((camp) => {
            const top3 = camp.students.slice(0, 3);
            const campMaxScore = camp.students.length > 0 ? camp.students[0].score : 1000;
            return renderLeaderboardTable(top3, camp.campusName, campMaxScore, true);
          })
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Staff View (Head, Counsellor, Campus-Scoped Admin): Their Campus Top 3 Only
  // ─────────────────────────────────────────────────────────────────────────────
  if (isStaff) {
    const topScore = students.length > 0 && students[0].score > 0 ? `${students[0].score} pts` : "0 pts";
    const topStreak = students.length > 0 && students[0].streak > 0 ? `${students[0].streak}d` : "0d";

    return (
      <div className="campus-rankings">
        {/* Staff Hero Banner */}
        <div className="cr-hero">
          <div className="cr-hero__left">
            <span className="cr-hero__tag">
              <BuildingIcon /> {campusName}
            </span>
            <h2 className="cr-hero__title">Student Wellness Rankings</h2>
            <p className="cr-hero__sub">
              Top 3 student leaders leading this session among enrolled students at <strong>{campusName}</strong>.
            </p>
          </div>

          <div className="cr-hero__user-card">
            <div className="cr-hero__user-card-label">Campus Standing</div>
            <div className="cr-hero__user-card-name">{campusName}</div>
            <div className="cr-hero__user-metrics">
              <div className="cr-hero__user-stat">
                <span className="cr-hero__user-stat-val">Top 3</span>
                <span className="cr-hero__user-stat-lbl">Leaderboard</span>
              </div>
              <div className="cr-hero__user-stat">
                <span className="cr-hero__user-stat-val" style={{ color: "#34d399" }}>
                  {students.length}
                </span>
                <span className="cr-hero__user-stat-lbl">Enrolled Peers</span>
              </div>
              <div className="cr-hero__user-stat">
                <span className="cr-hero__user-stat-val">{topScore}</span>
                <span className="cr-hero__user-stat-lbl">Top Score ({topStreak})</span>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#64748b" }}>
            Loading real student rankings for {campusName}…
          </div>
        ) : (
          renderLeaderboardTable(top3Students, campusName, maxScore, true)
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Regular Student User View: Top 3 + Your Standing + Points Boost Guide
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="campus-rankings">
      {/* Student Hero Banner */}
      <div className="cr-hero">
        <div className="cr-hero__left">
          <span className="cr-hero__tag">
            <BuildingIcon /> {campusName}
          </span>
          <h2 className="cr-hero__title">Student Wellness Rankings</h2>
          <p className="cr-hero__sub">
            Real-time rankings among enrolled students at <strong>{campusName}</strong>.
            Scores are earned through daily mindfulness streaks, wellness exercises, and personal diary reflections.
          </p>
        </div>

        {currentUserRanking && (
          <div className="cr-hero__user-card">
            <div className="cr-hero__user-card-label">Your Campus Standing</div>
            <div className="cr-hero__user-card-name">{currentUserRanking.name} (You)</div>
            <div className="cr-hero__user-metrics">
              <div className="cr-hero__user-stat">
                <span className="cr-hero__user-stat-val">#{currentUserRanking.rank}</span>
                <span className="cr-hero__user-stat-lbl">
                  Rank ({students.length} {students.length === 1 ? "Peer" : "Peers"})
                </span>
              </div>
              <div className="cr-hero__user-stat">
                <span className="cr-hero__user-stat-val" style={{ color: "#34d399" }}>
                  {currentUserRanking.score} pts
                </span>
                <span className="cr-hero__user-stat-lbl">Total Score</span>
              </div>
              <div className="cr-hero__user-stat">
                <span className="cr-hero__user-stat-val">{currentUserRanking.streak}d</span>
                <span className="cr-hero__user-stat-lbl">Streak</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#64748b" }}>
          Loading real student rankings for {campusName}…
        </div>
      ) : (
        <>
          {renderLeaderboardTable(top3Students, campusName, maxScore, false)}

          {/* How to Boost Your Score Guide for Students */}
          <div className="cr-table-card">
            <div className="cr-section-header">
              <div>
                <h3 className="cr-section-title">
                  <TrendingUpIcon /> How to Boost Your Score & Rank
                </h3>
                <p className="cr-section-sub">
                  Complete daily wellness exercises and reflections to climb the {campusName} leaderboard!
                </p>
              </div>
            </div>

            <div className="cr-guide-grid">
              <div className="cr-guide-card">
                <div className="cr-guide-top">
                  <span className="cr-guide-icon cr-guide-icon--amber"><FlameIcon /></span>
                  <div>
                    <h4 className="cr-guide-title">Daily Login Streak</h4>
                    <p className="cr-guide-desc">Log in daily to keep your mindfulness streak active.</p>
                  </div>
                </div>
                <div className="cr-guide-bottom">
                  <span className="cr-pts-tag">+50 pts</span>
                  <span style={{ fontSize: "0.75rem", color: "#16a34a", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                    <CheckIcon className="cr-check-icon" /> Active ({wellnessData.streak}d)
                  </span>
                </div>
              </div>

              <div className="cr-guide-card">
                <div className="cr-guide-top">
                  <span className="cr-guide-icon cr-guide-icon--purple"><BookOpenIcon /></span>
                  <div>
                    <h4 className="cr-guide-title">Journal Reflections</h4>
                    <p className="cr-guide-desc">Write your thoughts in your private daily diary.</p>
                  </div>
                </div>
                <div className="cr-guide-bottom">
                  <span className="cr-pts-tag">+50 pts</span>
                  {onSelectSection && (
                    <button
                      type="button"
                      className="cr-guide-action-btn"
                      onClick={() => onSelectSection("journal")}
                    >
                      Open Diary →
                    </button>
                  )}
                </div>
              </div>

              <div className="cr-guide-card">
                <div className="cr-guide-top">
                  <span className="cr-guide-icon cr-guide-icon--teal"><LotusIcon /></span>
                  <div>
                    <h4 className="cr-guide-title">Wellness Exercise</h4>
                    <p className="cr-guide-desc">Complete breathing exercises, meditation, or grounding.</p>
                  </div>
                </div>
                <div className="cr-guide-bottom">
                  <span className="cr-pts-tag">+50 pts</span>
                  {onSelectSection && (
                    <button
                      type="button"
                      className="cr-guide-action-btn"
                      onClick={() => onSelectSection("games")}
                    >
                      Start Exercise →
                    </button>
                  )}
                </div>
              </div>

              <div className="cr-guide-card">
                <div className="cr-guide-top">
                  <span className="cr-guide-icon cr-guide-icon--emerald"><StarIcon /></span>
                  <div>
                    <h4 className="cr-guide-title">Daily Challenge Bonus</h4>
                    <p className="cr-guide-desc">Complete streak, journal, and exercise in a single day.</p>
                  </div>
                </div>
                <div className="cr-guide-bottom">
                  <span className="cr-pts-tag" style={{ background: "#ecfdf5", color: "#059669" }}>
                    +100 pts Bonus
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "600" }}>Daily Goal</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

