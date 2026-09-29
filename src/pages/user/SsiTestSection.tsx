import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { computeSsiSeverity } from "../../config/ssiForm";
import {
  listSsiCollegeResultsForUser,
  submitSsiCollegeResult,
  type SsiCollegeResult,
} from "../../services/firebase/ssiCollegeResults";
import { SsiTestForm, type SsiAnswersPayload } from "../../components/booking/SsiTestForm";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import "./SsiTestSection.css";

export function SsiTestSection() {
  const { currentUser, profile } = useAuth();
  const [history, setHistory] = useState<SsiCollegeResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [taking, setTaking] = useState(false);

  async function refresh() {
    if (!currentUser) return;
    const results = await listSsiCollegeResultsForUser(currentUser.uid).catch(() => []);
    setHistory(results.sort((a, b) => b.submittedAt - a.submittedAt));
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  if (loading) return null;

  if (taking && profile && currentUser) {
    return (
      <div className="ssi-test-section">
        <SsiTestForm
          profile={profile}
          initialWhatsappNumber={profile.whatsappNumber}
          chrome="inline"
          onSubmit={async (answers: SsiAnswersPayload) => {
            if (!profile.collegeId) return;
            const severity = computeSsiSeverity({
              depression: answers.depressionScore,
              anxiety: answers.anxietyScore,
              stress: answers.stressScore,
              selfHarmAnswer: answers.level3Answers.find((a) => a.id === "l3_q1")?.answer,
              traumaAnswer: answers.level3Answers.find((a) => a.id === "l3_q2")?.answer,
            });
            await submitSsiCollegeResult({
              userId: currentUser.uid,
              userEmail: profile.email,
              displayName: profile.displayName ?? profile.email,
              collegeId: profile.collegeId,
              campusId: profile.campusId,
              severity,
              ...answers,
            });
          }}
          onClose={() => {
            setTaking(false);
            refresh();
          }}
        />
      </div>
    );
  }

  return (
    <div className="ssi-test-section">
      <Card className="ssi-test-section__header-card">
        <h2 className="ssi-test-section__title">SSI Test</h2>
        <p className="ssi-test-section__subtitle">
          A short, confidential wellbeing check-in that helps your college's counsellor and head understand
          how you've been feeling lately — takes about 5 minutes across 4 quick pages. Take it whenever you
          like, as often as you like.
        </p>
      </Card>

      {!profile?.collegeId ? (
        <Card className="ssi-test-section__empty-card">
          <p>Your account isn't linked to a college yet — contact your administrator to take this test.</p>
        </Card>
      ) : (
        <Card className="ssi-test-section__prompt-card">
          <div className="ssi-test-section__prompt-icon">📝</div>
          <div className="ssi-test-section__prompt-text">
            <h3>Take the SSI Test</h3>
            <p>A quick, confidential check-in with your college's wellness team.</p>
          </div>
          <Button type="button" onClick={() => setTaking(true)}>
            Take Test →
          </Button>
        </Card>
      )}

      {history.length > 0 && (
        <Card className="ssi-test-section__history-card">
          <h3 className="ssi-test-section__history-title">Your past check-ins</h3>
          <div className="ssi-test-section__history-list">
            {history.map((r) => (
              <div key={r.id} className="ssi-test-section__history-row">
                <span className="ssi-test-section__history-date">
                  {new Date(r.submittedAt).toLocaleString()}
                </span>
                <span className="ssi-test-section__submitted-badge">✓ Submitted</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
