import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../services/firebase/config";
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
import { Select } from "../../components/common/Select";
import { formatDateTimeDMY } from "../../utils/formatDate";
import "./SeriousCasesSection.css";

interface CollegeCounsellor {
  uid: string;
  name: string;
  email: string;
}

/** The case is resolved and the targeted admin wants to tell the college's
    own counsellor(s) it's been handled — same Gmail web-compose approach
    used on the Crisis SOS emergency alert card and the Notify Admin status
    chip: no OS mail-client registration needed, opens directly in a new
    tab. Pre-addressed straight to the one counsellor if there's only one
    for this college; the admin picks which one when there's more than
    one. */
function gmailComposeHref(to: string, subject: string): string {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}`;
}

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
  const [loadingCounsellors, setLoadingCounsellors] = useState(false);
  const [collegeCounsellors, setCollegeCounsellors] = useState<CollegeCounsellor[]>([]);
  const [emailRecipientUid, setEmailRecipientUid] = useState("");
  const [emailError, setEmailError] = useState("");

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

  async function handleEmailResolved() {
    if (!detail) return;
    setEmailError("");
    setEmailRecipientUid("");
    setLoadingCounsellors(true);
    try {
      const snap = detail.collegeId
        ? await getDocs(
            query(collection(db, "users"), where("role", "==", "counsellor"), where("collegeId", "==", detail.collegeId)),
          )
        : null;
      const counsellors: CollegeCounsellor[] = (snap?.docs ?? []).map((d) => ({
        uid: d.id,
        name: (d.data().displayName as string) || (d.data().email as string),
        email: d.data().email as string,
      }));
      setCollegeCounsellors(counsellors);

      const subject = `Case Resolved — ${detail.studentEmail} — ${formatDateTimeDMY(detail.createdAt)}`;
      if (counsellors.length === 1) {
        window.open(gmailComposeHref(counsellors[0].email, subject), "_blank", "noopener,noreferrer");
      } else if (counsellors.length === 0) {
        // No counsellor record for this college — fall back to whoever
        // actually filed the case, so this never dead-ends with nothing to
        // send to.
        window.open(gmailComposeHref(detail.authorEmail, subject), "_blank", "noopener,noreferrer");
      }
      // More than one match: left for the picker below to resolve — the
      // admin selects one, which opens the compose window itself.
    } catch {
      setEmailError("Couldn't look up this college's counsellors. Please try again.");
    } finally {
      setLoadingCounsellors(false);
    }
  }

  function handleSendToSelected() {
    if (!detail || !emailRecipientUid) return;
    const recipient = collegeCounsellors.find((c) => c.uid === emailRecipientUid);
    if (!recipient) return;
    const subject = `Case Resolved — ${detail.studentEmail} — ${formatDateTimeDMY(detail.createdAt)}`;
    window.open(gmailComposeHref(recipient.email, subject), "_blank", "noopener,noreferrer");
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
        <Modal
          title={`${detail.isEmergency ? "Crisis SOS" : "Flagged session"} — ${detail.studentEmail}`}
          onClose={() => {
            setDetailId(null);
            setCollegeCounsellors([]);
            setEmailRecipientUid("");
            setEmailError("");
          }}
        >
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
              <Button type="button" variant="outlined" disabled={loadingCounsellors} onClick={handleEmailResolved}>
                {loadingCounsellors ? "Looking up counsellors…" : "Email"}
              </Button>
              {collegeCounsellors.length > 1 && (
                <div className="serious-cases__email-picker">
                  <label htmlFor="serious-case-email-recipient">This college has more than one counsellor — pick one:</label>
                  <Select id="serious-case-email-recipient" value={emailRecipientUid} onChange={setEmailRecipientUid}>
                    <option value="" disabled>
                      Select a counsellor…
                    </option>
                    {collegeCounsellors.map((c) => (
                      <option key={c.uid} value={c.uid}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                  <Button type="button" disabled={!emailRecipientUid} onClick={handleSendToSelected}>
                    Open email to this counsellor
                  </Button>
                </div>
              )}
              {emailError && <p className="serious-cases__error">{emailError}</p>}
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
