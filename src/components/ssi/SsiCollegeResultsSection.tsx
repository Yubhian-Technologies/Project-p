import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { SSI_SEVERITY_LABELS, type SsiSeverity } from "../../config/ssiForm";
import { listSsiCollegeResultsForCollege, type SsiCollegeResult } from "../../services/firebase/ssiCollegeResults";
import { exportSsiResultsCsv } from "../../utils/exportSsiResultsCsv";
import { Card } from "../common/Card";
import { Button } from "../common/Button";
import { Modal } from "../common/Modal";
import "./SsiCollegeResultsSection.css";

const SEVERITY_RANK: Record<SsiSeverity, number> = { severe: 0, medium: 1, normal: 2 };

export function SsiCollegeResultsSection() {
  const { profile } = useAuth();
  const [results, setResults] = useState<SsiCollegeResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<SsiCollegeResult | null>(null);

  useEffect(() => {
    if (!profile?.collegeId) {
      setLoading(false);
      return;
    }
    listSsiCollegeResultsForCollege(profile.collegeId)
      .then((list) => {
        const sorted = [...list].sort((a, b) => {
          const rankDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
          return rankDiff !== 0 ? rankDiff : b.submittedAt - a.submittedAt;
        });
        setResults(sorted);
      })
      .finally(() => setLoading(false));
  }, [profile?.collegeId]);

  if (loading) return null;

  if (!profile?.collegeId) {
    return (
      <Card className="ssi-results__empty-card">
        <p>Your account has no college assigned — contact an admin to set this up.</p>
      </Card>
    );
  }

  return (
    <div className="ssi-results">
      <Card className="ssi-results__header-card">
        <div className="ssi-results__header-row">
          <div>
            <h2 className="ssi-results__title">SSI Test Results</h2>
            <p className="ssi-results__subtitle">
              Standalone SSI check-ins submitted by students at your college, sorted by severity.
            </p>
          </div>
          <Button
            type="button"
            variant="outlined"
            disabled={results.length === 0}
            onClick={() => exportSsiResultsCsv(results)}
          >
            Export to CSV
          </Button>
        </div>
      </Card>

      {results.length === 0 && (
        <Card className="ssi-results__empty-card">
          <p>No SSI check-ins have been submitted by students at your college yet.</p>
        </Card>
      )}

      <div className="ssi-results__list">
        {results.map((r) => (
          <Card
            key={r.id}
            className={`ssi-results__row ssi-results__row--${r.severity}`}
            onClick={() => setDetail(r)}
          >
            <div className="ssi-results__row-main">
              <span className="ssi-results__row-name">{r.displayName || r.userEmail}</span>
              <span className="ssi-results__row-meta">
                {r.level1.department || "—"} · {r.level1.year || "—"} · {new Date(r.submittedAt).toLocaleDateString()}
              </span>
            </div>
            <span className={`ssi-results__badge ssi-results__badge--${r.severity}`}>
              {SSI_SEVERITY_LABELS[r.severity]}
            </span>
          </Card>
        ))}
      </div>

      {detail && (
        <Modal title={detail.displayName || detail.userEmail} onClose={() => setDetail(null)} className="ssi-results__detail-modal">
          <span className={`ssi-results__badge ssi-results__badge--${detail.severity}`}>
            {SSI_SEVERITY_LABELS[detail.severity]}
          </span>

          <div className="ssi-results__score">
            <span className="ssi-results__score-val">
              {detail.likertScore}
              <small> / {detail.likertMax}</small>
            </span>
          </div>

          <div className="ssi-results__subscales">
            {[
              { key: "D", label: "Depression", value: detail.depressionScore },
              { key: "A", label: "Anxiety", value: detail.anxietyScore },
              { key: "S", label: "Stress", value: detail.stressScore },
            ].map((s) => (
              <div key={s.key} className="ssi-results__subscale">
                <span className="ssi-results__subscale-key">{s.key}</span>
                <span className="ssi-results__subscale-name">{s.label}</span>
                <span className="ssi-results__subscale-val">
                  {s.value}
                  <small> / 21</small>
                </span>
              </div>
            ))}
          </div>

          <div className="ssi-results__section">
            <h4 className="ssi-results__heading">About the student</h4>
            <dl className="ssi-results__dl">
              <dt>Email</dt>
              <dd>{detail.userEmail}</dd>
              <dt>Department</dt>
              <dd>{detail.level1.department || "—"}</dd>
              <dt>Year</dt>
              <dd>{detail.level1.year || "—"}</dd>
              <dt>Section</dt>
              <dd>{detail.level1.section || "—"}</dd>
              <dt>Hostel / Day Scholar</dt>
              <dd>{detail.level1.hostelOrDayScholar || "—"}</dd>
              <dt>Age</dt>
              <dd>{detail.level1.age || "—"}</dd>
              <dt>WhatsApp</dt>
              <dd>{detail.whatsappNumber || "—"}</dd>
              <dt>Submitted</dt>
              <dd>{new Date(detail.submittedAt).toLocaleString()}</dd>
            </dl>
          </div>

          <div className="ssi-results__section">
            <h4 className="ssi-results__heading">Assessment answers</h4>
            {detail.likertAnswers.map((a, i) => (
              <div key={a.id} className="ssi-results__row-answer">
                <span className="ssi-results__q">
                  {i + 1}. {a.label}
                </span>
                <span className={`ssi-results__a${a.value !== undefined && (a.value ?? 0) >= 2 ? " ssi-results__a--high" : ""}`}>
                  {a.answer}
                </span>
              </div>
            ))}
          </div>

          <div className="ssi-results__section">
            <h4 className="ssi-results__heading">Important questions</h4>
            {detail.level3Answers.map((a, i) => (
              <div key={a.id} className="ssi-results__row-answer">
                <span className="ssi-results__q">
                  {i + 1}. {a.label}
                </span>
                <span
                  className={`ssi-results__a${
                    a.id === "l3_q1" && (a.answer === "Yes" || a.answer === "Maybe") ? " ssi-results__a--high" : ""
                  }`}
                >
                  {a.answer || "—"}
                </span>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
