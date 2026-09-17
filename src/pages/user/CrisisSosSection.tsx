import { useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../../hooks/useAuth";
import { createEmergencySosBooking } from "../../services/firebase/bookings";
import { PhoneIcon, MapPinIcon, ShieldIcon } from "../../components/common/icons";
import "./CrisisSosSection.css";

interface EmergencyLine {
  id: string;
  icon: ReactNode;
  name: string;
  description: string;
  actionLabel: string;
  href?: string;
  accent: "red" | "indigo" | "green" | "purple";
}

// TODO: replace the campus-specific placeholder number and map query below with
// the real Vishnu campus emergency desk number / exact building location once
// they're available.
const EMERGENCY_LINES: EmergencyLine[] = [
  {
    id: "campus-emergency",
    icon: <PhoneIcon />,
    name: "Vishnu Campus Emergency Response",
    description: "24/7 on-duty Vishnu College security & emergency health desk (+91 88162 50864)",
    actionLabel: "CALL",
    href: "tel:+918816250864",
    accent: "red",
  },
  {
    id: "tele-manas",
    icon: <PhoneIcon />,
    name: "Tele-MANAS National Mental Health",
    description: "Govt. of India 24/7 free institutional toll-free counseling helpline",
    actionLabel: "CALL",
    href: "tel:14416",
    accent: "indigo",
  },
  {
    id: "kiran",
    icon: <PhoneIcon />,
    name: "KIRAN National Mental Health Helpline",
    description: "24/7 psychological support & early crisis intervention",
    actionLabel: "CALL",
    href: "tel:18005990019",
    accent: "green",
  },
  {
    id: "campus-counseling",
    icon: <MapPinIcon />,
    name: "Vishnu Health & Counseling Center",
    description: "Walk-in confidential counseling on-campus (A-Block Ground Floor)",
    actionLabel: "CAMPUS",
    href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      "Vishnu Institute of Technology Health and Counseling Center A-Block",
    )}`,
    accent: "purple",
  },
];

export function CrisisSosSection() {
  const { currentUser, profile } = useAuth();
  const [dispatching, setDispatching] = useState(false);
  const [dispatchedTo, setDispatchedTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDispatch() {
    if (!currentUser) return;
    setDispatching(true);
    setError(null);
    try {
      await createEmergencySosBooking(
        { uid: currentUser.uid, email: profile?.email ?? currentUser.email ?? "" },
        {
          displayName: profile?.displayName,
          whatsappNumber: profile?.whatsappNumber,
          studentOrProfessional: profile?.studentOrProfessional,
          campusId: profile?.campusId,
        },
      );
      setDispatchedTo(profile?.email ?? "a counsellor");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the emergency request. Please call a line below.");
    } finally {
      setDispatching(false);
    }
  }

  return (
    <div className="crisis-sos">
      <p className="crisis-sos__intro">
        If you or a peer are experiencing acute psychological distress, panic, or a life safety emergency, immediate
        help is available. You are not alone.
      </p>

      {dispatchedTo ? (
        <div className="crisis-sos__confirmation">
          Emergency SOS sent — {dispatchedTo} has been notified and will reach out shortly.
        </div>
      ) : (
        <button type="button" className="crisis-sos__dispatch" disabled={dispatching} onClick={handleDispatch}>
          <ShieldIcon /> {dispatching ? "Dispatching…" : "Dispatch Emergency SOS to On-Call Psychologist"}
        </button>
      )}
      {error && <p className="crisis-sos__error">{error}</p>}

      <h3 className="crisis-sos__section-title">Verified Emergency Lines</h3>
      <div className="crisis-sos__lines">
        {EMERGENCY_LINES.map((line) => (
          <div key={line.id} className={`crisis-sos__line crisis-sos__line--${line.accent}`}>
            <span className={`crisis-sos__line-icon crisis-sos__line-icon--${line.accent}`}>{line.icon}</span>
            <div className="crisis-sos__line-body">
              <strong>{line.name}</strong>
              <span className="crisis-sos__line-desc">{line.description}</span>
            </div>
            {line.href ? (
              <a
                className={`crisis-sos__line-action crisis-sos__line-action--${line.accent}`}
                href={line.href}
                {...(line.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
              >
                {line.actionLabel} ↗
              </a>
            ) : (
              <span className={`crisis-sos__line-action crisis-sos__line-action--${line.accent}`}>
                {line.actionLabel} ↗
              </span>
            )}
          </div>
        ))}
      </div>

      <p className="crisis-sos__footer">
        Part of the Vishnu Institute of Technology Student Mental Health &amp; Safety Charter. If this is a
        life-threatening emergency, please also contact local emergency services immediately.
      </p>
    </div>
  );
}
