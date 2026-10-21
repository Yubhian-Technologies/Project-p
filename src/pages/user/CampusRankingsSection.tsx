import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  getCampusStudentRankings,
  type CampusStudentRanking,
  type CampusLeaderboardResult,
} from "../../services/campusRankings";
import { getWellnessData } from "../../services/wellnessScore";
import { TrophyIcon, FlameIcon, BuildingIcon, TrendingUpIcon, CheckIcon } from "../../components/common/icons";
import "./CampusRankingsSection.css";

interface CampusRankingsSectionProps {
  onSelectSection?: (sectionId: string) => void;
}

export function CampusRankingsSection({ onSelectSection }: CampusRankingsSectionProps) {
  const { profile } = useAuth();
  const [data, setData] = useState<CampusLeaderboardResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [wellnessData, setWellnessData] = useState(getWellnessData());

  useEffect(() => {
    let isMounted = true;
    function loadData(isInitial = false) {
      if (isInitial) setLoading(true);
      getCampusStudentRankings(profile?.campusId, profile)
        .then((res) => {
          if (isMounted) {
            setData(res);
            setWellnessData(getWellnessData());
          }
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    }

    loadData(true);

    // Re-fetch rankings whenever the user completes a challenge or logs wellness activity
    function handleUpdate() {
      loadData(false);
    }

    window.addEventListener("wellness_score_updated", handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener("wellness_score_updated", handleUpdate);
    };
  }, [profile?.campusId, profile?.uid]);

  const students = data?.students || [];
  const campusName = data?.campusName || "Your Campus";
  const currentUserRanking = students.find((s) => s.isCurrentUser);
  const maxScore = students.length > 0 ? students[0].score : 1000;

  // Podium top 3 students
  const top1 = students.find((s) => s.rank === 1);
  const top2 = students.find((s) => s.rank === 2);
  const top3 = students.find((s) => s.rank === 3);

  return (
    <div className="campus-rankings">
      {/* ── Top Hero Banner ────────────────────────────────────────── */}
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
          {/* ── Top 3 Student Podium (Olympic style) ──────────────────── */}
          {top1 && (
            <div className="cr-podium-wrap">
              <div className="cr-section-header">
                <div>
                  <h3 className="cr-section-title">
                    <TrophyIcon /> {campusName} Leaders Podium
                  </h3>
                  <p className="cr-section-sub">Top scoring students leading this session at {campusName}</p>
                </div>
              </div>

              <div className="cr-podium">
                {/* 2nd Place: Silver */}
                {top2 ? (
                  <div className="cr-podium-step cr-podium-step--silver">
                    <div className="cr-podium-avatar">🥈</div>
                    <div className="cr-podium-name">{top2.name}</div>
                    <div className="cr-podium-score">{top2.score.toLocaleString()} pts</div>
                    {top2.isCurrentUser && <span className="cr-podium-user-tag">You</span>}
                    <div className="cr-podium-block">
                      <span className="cr-podium-rank-num">#2</span>
                    </div>
                  </div>
                ) : (
                  <div className="cr-podium-step" style={{ opacity: 0.4 }}>
                    <div className="cr-podium-avatar">🥈</div>
                    <div className="cr-podium-name">Awaiting Contender</div>
                    <div className="cr-podium-score">—</div>
                    <div className="cr-podium-block" style={{ height: "60px", background: "#e2e8f0" }}>
                      <span className="cr-podium-rank-num" style={{ color: "#94a3b8" }}>#2</span>
                    </div>
                  </div>
                )}

                {/* 1st Place: Gold */}
                <div className="cr-podium-step cr-podium-step--gold">
                  <div className="cr-podium-avatar">👑</div>
                  <div className="cr-podium-name">{top1.name}</div>
                  <div className="cr-podium-score">{top1.score.toLocaleString()} pts</div>
                  {top1.isCurrentUser && <span className="cr-podium-user-tag">You</span>}
                  <div className="cr-podium-block">
                    <span className="cr-podium-rank-num">#1</span>
                  </div>
                </div>

                {/* 3rd Place: Bronze */}
                {top3 ? (
                  <div className="cr-podium-step cr-podium-step--bronze">
                    <div className="cr-podium-avatar">🥉</div>
                    <div className="cr-podium-name">{top3.name}</div>
                    <div className="cr-podium-score">{top3.score.toLocaleString()} pts</div>
                    {top3.isCurrentUser && <span className="cr-podium-user-tag">You</span>}
                    <div className="cr-podium-block">
                      <span className="cr-podium-rank-num">#3</span>
                    </div>
                  </div>
                ) : (
                  <div className="cr-podium-step" style={{ opacity: 0.4 }}>
                    <div className="cr-podium-avatar">🥉</div>
                    <div className="cr-podium-name">Awaiting Contender</div>
                    <div className="cr-podium-score">—</div>
                    <div className="cr-podium-block" style={{ height: "50px", background: "#e2e8f0" }}>
                      <span className="cr-podium-rank-num" style={{ color: "#94a3b8" }}>#3</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Complete Campus Student Standings Table ───────────────── */}
          <div className="cr-table-card">
            <div className="cr-section-header">
              <div>
                <h3 className="cr-section-title">
                  <BuildingIcon /> {campusName} Student Leaderboard
                </h3>
                <p className="cr-section-sub">
                  Full ranking of students enrolled at {campusName} by wellness score and daily streak
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
                  {students.map((student) => {
                    const pct = Math.max(10, Math.round((student.score / maxScore) * 100));
                    return (
                      <tr key={student.uid} className={student.isCurrentUser ? "is-user-campus" : ""}>
                        <td>
                          <span className={`cr-rank-badge cr-rank-badge--${student.rank}`}>
                            {student.rank === 1 ? "🥇" : student.rank === 2 ? "🥈" : student.rank === 3 ? "🥉" : `#${student.rank}`}
                          </span>
                        </td>
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
                            {student.isCurrentUser && <span className="cr-you-pill">You</span>}
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
                            <FlameIcon /> {student.streak}d
                          </span>
                        </td>
                        <td>
                          <span className="cr-badge-pill">{student.badge}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── How to Boost Your Score ───────────────────────────────── */}
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
                  <span className="cr-guide-icon cr-guide-icon--amber">🔥</span>
                  <div>
                    <h4 className="cr-guide-title">Daily Login Streak</h4>
                    <p className="cr-guide-desc">Log in daily to keep your mindfulness streak active.</p>
                  </div>
                </div>
                <div className="cr-guide-bottom">
                  <span className="cr-pts-tag">+50 pts</span>
                  <span style={{ fontSize: "0.75rem", color: "#16a34a", fontWeight: "700" }}>
                    <CheckIcon /> Active ({wellnessData.streak}d)
                  </span>
                </div>
              </div>

              <div className="cr-guide-card">
                <div className="cr-guide-top">
                  <span className="cr-guide-icon cr-guide-icon--purple">📖</span>
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
                  <span className="cr-guide-icon cr-guide-icon--teal">🧘</span>
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
                  <span className="cr-guide-icon cr-guide-icon--emerald">⭐</span>
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
