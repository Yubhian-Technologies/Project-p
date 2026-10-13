import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../services/firebase/config";
import { useAuth } from "../../hooks/useAuth";
import { listEventsForCollege } from "../../services/firebase/events";
import { listSsiCollegeResultsForCollege } from "../../services/firebase/ssiCollegeResults";
import { subscribeToAdminSeriousCases } from "../../services/firebase/seriousCases";
import type { EventProgram } from "../../types/event";
import type { SsiCollegeResult } from "../../services/firebase/ssiCollegeResults";
import type { SeriousCase } from "../../types/seriousCase";
import { TrendingUpIcon } from "../../components/common/icons";
import "./PrincipalHomeOverview.css";

interface PrincipalHomeOverviewProps {
  onSelectSection: (sectionId: string) => void;
}

// Same icon markup as the sidebar's own section icons (AdminDashboard.tsx),
// reused here so each card visually matches the tab it jumps to.
const SECTION_ICONS: Record<string, ReactNode> = {
  events: (
    <svg viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  analytics: (
    <svg viewBox="0 0 24 24">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  "ssi-analytics": (
    <svg viewBox="0 0 24 24">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  "serious-cases": (
    <svg viewBox="0 0 24 24">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  "counsellor-worksheet": (
    <svg viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** The Home overview for a college-restricted Principal/Vice-Principal — a
    clean set of shortcut cards summarizing their own granted sections
    (Events, Analytics, SSI Analytics, Counsellor Worksheet, and Serious
    Cases when granted), so they can see what needs attention at a glance
    and jump straight to it, instead of the campus-wide Consolidated
    Reports widget other admins get (irrelevant to a single-college role). */
export function PrincipalHomeOverview({ onSelectSection }: PrincipalHomeOverviewProps) {
  const { profile } = useAuth();
  const [events, setEvents] = useState<EventProgram[]>([]);
  const [ssiResults, setSsiResults] = useState<SsiCollegeResult[]>([]);
  const [counsellorCount, setCounsellorCount] = useState<number | null>(null);
  const [seriousCases, setSeriousCases] = useState<SeriousCase[]>([]);
  const [loading, setLoading] = useState(true);

  const collegeIds = profile?.adminAccess?.collegeIds ?? [];
  const grantedSections = profile?.adminAccess?.sections;
  const seesSeriousCases = !grantedSections || grantedSections.includes("serious-cases");

  useEffect(() => {
    if (!profile || collegeIds.length === 0) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    Promise.all([
      Promise.all(collegeIds.map((id) => listEventsForCollege(id))).then((lists) => lists.flat()),
      Promise.all(collegeIds.map((id) => listSsiCollegeResultsForCollege(id))).then((lists) => lists.flat()),
      Promise.all(
        collegeIds.map((id) =>
          getDocs(query(collection(db, "users"), where("role", "==", "counsellor"), where("collegeId", "==", id))),
        ),
      ).then((snaps) => snaps.reduce((sum, s) => sum + s.size, 0)),
    ])
      .then(([eventList, ssiList, counsellors]) => {
        if (!active) return;
        setEvents(eventList);
        setSsiResults(ssiList);
        setCounsellorCount(counsellors);
      })
      .catch((err) => console.error("Failed to load Principal home overview", err))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.uid]);

  useEffect(() => {
    if (!profile || !seesSeriousCases) {
      setSeriousCases([]);
      return;
    }
    return subscribeToAdminSeriousCases(profile, setSeriousCases);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.uid, seesSeriousCases]);

  const now = Date.now();
  const upcomingEvents = events.filter((e) => e.eventDate >= now && e.eventDate <= now + 30 * DAY_MS);
  const severeSsi = ssiResults.filter((r) => r.severity === "severe").length;
  const openCases = seriousCases.filter((c) => c.status === "open").length;

  if (!collegeIds.length) return null;

  const cards: {
    id: string;
    label: string;
    value: string;
    hint: string;
    urgent?: boolean;
  }[] = [
    {
      id: "events",
      label: "Events & Programs",
      value: loading ? "…" : String(upcomingEvents.length),
      hint: "upcoming in 30 days",
    },
    {
      id: "analytics",
      label: "Analytics",
      value: loading || counsellorCount === null ? "…" : String(counsellorCount),
      hint: "counsellors at your college",
    },
    {
      id: "ssi-analytics",
      label: "SSI Analytics",
      value: loading ? "…" : String(severeSsi),
      hint: "severe check-ins",
      urgent: severeSsi > 0,
    },
    {
      id: "counsellor-worksheet",
      label: "Counsellor Worksheet",
      value: "→",
      hint: "view monthly worksheets",
    },
  ];

  if (seesSeriousCases) {
    cards.splice(3, 0, {
      id: "serious-cases",
      label: "Serious Cases",
      value: loading ? "…" : String(openCases),
      hint: "awaiting your action",
      urgent: openCases > 0,
    });
  }

  // Only show a card for a section this Principal/VP was actually granted —
  // a card is a shortcut into that tab, so it shouldn't offer one the Super
  // Admin didn't check for them in the first place.
  const visibleCards = grantedSections ? cards.filter((c) => grantedSections.includes(c.id as (typeof grantedSections)[number])) : cards;

  if (visibleCards.length === 0) return null;

  return (
    <div className="pha-overview">
      <div className="pha-header">
        <h3 className="pha-header__title">
          <TrendingUpIcon />
          <span>Your College at a Glance</span>
        </h3>
        <p className="pha-header__sub">Tap any card to open that section.</p>
      </div>

      <div className="pha-grid">
        {visibleCards.map((card) => (
          <button
            key={card.id}
            type="button"
            className={`pha-card${card.urgent ? " pha-card--urgent" : ""}`}
            onClick={() => onSelectSection(card.id)}
          >
            <span className="pha-card__icon">{SECTION_ICONS[card.id]}</span>
            <span className="pha-card__body">
              <span className="pha-card__value">{card.value}</span>
              <span className="pha-card__label">{card.label}</span>
              <span className="pha-card__hint">{card.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
