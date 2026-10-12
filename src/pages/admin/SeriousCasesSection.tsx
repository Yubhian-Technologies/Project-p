import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { listCampuses } from "../../services/firebase/campuses";
import { listColleges } from "../../services/firebase/colleges";
import {
  subscribeToAdminSeriousCases,
  recordActionTaken,
  recordDelayReason,
} from "../../services/firebase/seriousCases";
import type { SeriousCase } from "../../types/seriousCase";
import type { Campus } from "../../types/campus";
import type { College } from "../../types/college";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { Modal } from "../../components/common/Modal";
import { formatDateTimeDMY } from "../../utils/formatDate";
import "./SeriousCasesSection.css";

const TARGET_TIER_LABELS: Record<SeriousCase["targetTier"], string> = {
  "principal-vp": "Principal / Vice-Principal",
  "management-fallback": "Management / Administration",
  "global-fallback": "Global Admin",
};

export function SeriousCasesSection() {
  const { profile } = useAuth();
  const [cases, setCases] = useState<SeriousCase[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [actionText, setActionText] = useState("");
  const [delayText, setDelayText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listCampuses().then((list) => {
      setCampuses(list);
      Promise.all(list.map((c) => listColleges(c.id))).then((lists) => setColleges(lists.flat()));
    });
  }, []);

  useEffect(() => {
    if (!profile) return;
    const unsubscribe = subscribeToAdminSeriousCases(profile, (list) => {
      setCases(list);
      setLoading(false);
    });
    return unsubscribe;
  }, [profile]);

  if (loading) return null;

  const campusName = (id: string) => campuses.find((c) => c.id === id)?.name ?? "Unknown campus";
  const collegeName = (id: string | null) => (id ? colleges.find((c) => c.id === id)?.name ?? "Unknown college" : "—");

  const sorted = [...cases].sort((a, b) => {
    const overdueA = a.status === "open" && a.escalationCount > 0;
    const overdueB = b.status === "open" && b.escalationCount > 0;
    if (overdueA !== overdueB) return overdueA ? -1 : 1;
    if ((a.status === "open") !== (b.status === "open")) return a.status === "open" ? -1 : 1;
    return b.createdAt - a.createdAt;
  });

  const detail = cases.find((c) => c.id === detailId) ?? null;
  const isTargeted = !!detail && !!profile && detail.targetAdminUids.includes(profile.uid);

  async function handleResolve() {
    if (!detail || !profile || !actionText.trim()) return;
    setSaving(true);
    setError("");
    try {
      await recordActionTaken(detail, actionText.trim(), { uid: profile.uid, email: profile.email });
      setActionText("");
    } catch {
      setError("Couldn't save this. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelay() {
    if (!detail || !profile || !delayText.trim()) return;
    setSaving(true);
    setError("");
    try {
      await recordDelayReason(detail, delayText.trim(), { uid: profile.uid, email: profile.email });
      setDelayText("");
    } catch {
      setError("Couldn't save this. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="serious-cases">
      <Card className="serious-cases__header-card">
        <p className="serious-cases__subtitle">
          Cases a Counsellor or Head has escalated to admin — from a Crisis SOS case, or a normal session they
          judged serious. Overdue cases (24h+ with no action taken) are shown first.
        </p>
      </Card>

      {sorted.length === 0 && (
        <Card className="serious-cases__empty-card">
          <p>No cases have been flagged yet.</p>
        </Card>
      )}

      <div className="serious-cases__list">
        {sorted.map((c) => {
          const overdue = c.status === "open" && c.escalationCount > 0;
          return (
            <Card
              key={c.id}
              className={`serious-cases__row serious-cases__row--${
                c.status === "resolved" ? "resolved" : overdue ? "overdue" : "open"
              }`}
              onClick={() => setDetailId(c.id)}
            >
              <div className="serious-cases__row-main">
                <span className="serious-cases__row-title">
                  {c.isEmergency ? "🚨 Crisis SOS" : "Flagged session"} — {c.studentEmail}
                </span>
                <span className="serious-cases__row-meta">
                  {campusName(c.campusId)} · {collegeName(c.collegeId)} · {c.authorEmail} ·{" "}
                  {formatDateTimeDMY(c.createdAt)}
                </span>
              </div>
              <span
                className={`serious-cases__badge serious-cases__badge--${
                  c.status === "resolved" ? "resolved" : overdue ? "overdue" : "open"
                }`}
              >
                {c.status === "resolved" ? "Resolved" : overdue ? `Overdue ×${c.escalationCount}` : "Awaiting action"}
              </span>
            </Card>
          );
        })}
      </div>

      {detail && (
        <Modal title={`${detail.isEmergency ? "Crisis SOS" : "Flagged session"} — ${detail.studentEmail}`} onClose={() => setDetailId(null)}>
          <dl className="serious-cases__dl">
            <dt>Campus</dt>
            <dd>{campusName(detail.campusId)}</dd>
            <dt>College</dt>
            <dd>{collegeName(detail.collegeId)}</dd>
            <dt>Filed by</dt>
            <dd>
              {detail.authorEmail} ({detail.originRole})
            </dd>
            <dt>Assigned to</dt>
            <dd>{TARGET_TIER_LABELS[detail.targetTier]}</dd>
            <dt>Filed on</dt>
            <dd>{formatDateTimeDMY(detail.createdAt)}</dd>
          </dl>

          <div className="serious-cases__section">
            <h4 className="serious-cases__heading">Note</h4>
            <p className="serious-cases__note">{detail.note}</p>
          </div>

          {detail.escalations.length > 0 && (
            <div className="serious-cases__section">
              <h4 className="serious-cases__heading">History</h4>
              <ul className="serious-cases__history">
                {detail.escalations.map((e, i) => (
                  <li key={i}>
                    {e.type === "re-notified" ? (
                      <span>Overdue re-notification sent — {formatDateTimeDMY(e.at)}</span>
                    ) : (
                      <span>
                        <strong>{e.byEmail}</strong> explained the delay ({formatDateTimeDMY(e.at)}): {e.text}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {detail.status === "resolved" && detail.actionTaken && (
            <div className="serious-cases__section">
              <h4 className="serious-cases__heading">Action taken</h4>
              <p className="serious-cases__note">
                {detail.actionTaken.text}
                <br />
                <span className="serious-cases__note-byline">
                  — {detail.actionTaken.byEmail}, {formatDateTimeDMY(detail.actionTaken.at)}
                </span>
              </p>
            </div>
          )}

          {detail.status === "open" && isTargeted && (
            <div className="serious-cases__section">
              <h4 className="serious-cases__heading">Action taken</h4>
              <textarea
                rows={3}
                value={actionText}
                onChange={(e) => setActionText(e.target.value)}
                placeholder="What action was taken on this case?"
              />
              <Button type="button" disabled={!actionText.trim() || saving} onClick={handleResolve}>
                {saving ? "Saving…" : "Mark resolved"}
              </Button>
            </div>
          )}

          {detail.status === "open" && detail.escalationCount > 0 && isTargeted && (
            <div className="serious-cases__section">
              <h4 className="serious-cases__heading">Why hasn't action been taken yet?</h4>
              <textarea
                rows={2}
                value={delayText}
                onChange={(e) => setDelayText(e.target.value)}
                placeholder="This is logged, but doesn't resolve the case."
              />
              <Button type="button" variant="outlined" disabled={!delayText.trim() || saving} onClick={handleDelay}>
                {saving ? "Saving…" : "Log reason"}
              </Button>
            </div>
          )}

          {error && <p className="serious-cases__error">{error}</p>}
        </Modal>
      )}
    </div>
  );
}
