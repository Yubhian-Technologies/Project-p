import { useRef, useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { ProfileSection } from "../../components/layout/ProfileSection";
import { BentoCard } from "../../components/common/BentoCard";
import { useAuth } from "../../hooks/useAuth";
import { BookingSection } from "./BookingSection";
import { CampusCounsellorsSection } from "./CampusCounsellorsSection";
import { SsiTestSection } from "./SsiTestSection";
import { UpcomingEventsSection } from "./UpcomingEventsSection";
import { UpcomingEventsCard } from "./UpcomingEventsCard";
import { GamesSection } from "./games/GamesSection";
import type { GamesSectionHandle } from "./games/GamesSection";
import { GamesSummaryCard } from "./games/GamesSummaryCard";
import { JournalSection } from "./journal/JournalSection";
import { CommunitySection } from "./community/CommunitySection";
import { CrisisSosSection } from "./CrisisSosSection";
import { DailyQuoteCard } from "../../components/common/DailyQuoteCard";
import { FlashQACard } from "../../components/common/FlashQACard";
import { MoodTrackerCard } from "../../components/common/MoodTrackerCard";
import { WellnessScoreBanner } from "../../components/common/WellnessScoreBanner";
import { UserHomeActivityOverview } from "./UserHomeActivityOverview";
import { VishnuWellnessMissionCard } from "../../components/common/VishnuWellnessMissionCard";
import type { Notification } from "../../types/notification";
import "../../styles/bento-grid.css";

const SECTIONS = [
  {
    id: "overview",
    label: "Home",
    icon: (
      <svg viewBox="0 0 24 24"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" /><path d="M9 21V12h6v9" /></svg>
    ),
  },
  {
    id: "campus-counsellors",
    label: "Campus Counsellors",
    icon: (
      <svg viewBox="0 0 24 24"><circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /><path d="M21 21v-2a4 4 0 0 0-3-3.87" /></svg>
    ),
  },
  {
    id: "booking",
    label: "Book Session",
    icon: (
      <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><polyline points="9 16 11 18 15 14" /></svg>
    ),
  },
  {
    id: "ssi-test",
    label: "SSI Assessment Test",
    icon: (
      <svg viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="13" y2="16" /></svg>
    ),
  },
  {
    id: "events",
    label: "Events & Programs",
    icon: (
      <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
    ),
  },
  {
    id: "games",
    label: "Wellness Exercise",
    icon: (
      <svg viewBox="0 0 24 24"><path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" /></svg>
    ),
  },
  {
    id: "journal",
    label: "Counselling Journal",
    icon: (
      <svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
    ),
  },
  {
    id: "community",
    label: "Wellness Community",
    icon: (
      <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
    ),
  },
  {
    id: "crisis-sos",
    label: "Crisis SOS",
    variant: "urgent" as const,
    icon: (
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
    ),
  },
];

export function UserDashboard() {
  const { profile } = useAuth();
  const [activeSection, setActiveSection] = useState("overview");
  const [chatBookingId, setChatBookingId] = useState<string | undefined>();
  const [resourceBookingId, setResourceBookingId] = useState<string | undefined>();
  const [compensationBookingId, setCompensationBookingId] = useState<string | undefined>();
  const [ssiBookingId, setSsiBookingId] = useState<string | undefined>();
  const gamesRef = useRef<GamesSectionHandle>(null);
  const [gameOpen, setGameOpen] = useState(false);

  function handleNotificationClick(notification: Notification) {
    setActiveSection("booking");
    if (notification.type === "chat_message") {
      setChatBookingId(notification.bookingId);
    } else if (notification.type === "session_resource_added" || notification.type === "session_summary_shared") {
      setResourceBookingId(notification.bookingId);
    } else if (notification.type === "compensation_offered") {
      setCompensationBookingId(notification.bookingId);
    } else if (notification.type === "ssi_suggested") {
      setSsiBookingId(notification.bookingId);
    }
  }

  const titleBySection: Record<string, string> = {
    profile: "Profile",
    "campus-counsellors": "Campus Counsellors & Heads",
    booking: "Book Session",
    "ssi-test": "SSI Assessment Test",
    events: "Events & Programs",
    games: "Wellness Exercise",
    journal: "Counselling Journal",
    community: "Wellness Community",
    "crisis-sos": "Crisis SOS",
  };
  const title = titleBySection[activeSection] ?? "User Dashboard";

  return (
    <AppShell
      title={title}
      titleLeadingAction={
        activeSection === "games" && gameOpen ? (
          <button
            type="button"
            className="app-shell__title-back"
            aria-label="Back to Wellness Exercises"
            title="Back to Wellness Exercises"
            onClick={() => gamesRef.current?.goBack()}
          >
            ←
          </button>
        ) : undefined
      }
      sections={SECTIONS}
      activeSection={activeSection}
      onSelectSection={setActiveSection}
      onNotificationClick={handleNotificationClick}
    >
      {activeSection === "profile" && <ProfileSection />}
      {activeSection === "campus-counsellors" && <CampusCounsellorsSection />}
      {activeSection === "booking" && (
        <BookingSection
          openChatBookingId={chatBookingId}
          onChatOpened={() => setChatBookingId(undefined)}
          openSsiBookingId={ssiBookingId}
          onSsiOpened={() => setSsiBookingId(undefined)}
          openResourceBookingId={resourceBookingId}
          onResourceOpened={() => setResourceBookingId(undefined)}
          openCompensationBookingId={compensationBookingId}
          onCompensationOpened={() => setCompensationBookingId(undefined)}
        />
      )}
      {activeSection === "ssi-test" && <SsiTestSection />}
      {activeSection === "events" && <UpcomingEventsSection />}
      {activeSection === "games" && <GamesSection ref={gamesRef} onActiveChange={setGameOpen} />}
      {activeSection === "journal" && <JournalSection />}
      {activeSection === "community" && <CommunitySection />}
      {activeSection === "crisis-sos" && <CrisisSosSection />}
      {activeSection === "overview" && (
        <div className="bento-grid">
          <BentoCard
            span={12}
            variant="hero"
            title={`Welcome back, ${profile?.displayName || profile?.email || "Student"}`}
            subtitle="Your personal mental wellness journey and session tracker."
            action={{
              label: "Book 1-on-1 Session →",
              variant: "secondary",
              onClick: () => setActiveSection("booking"),
            }}
          >
            <WellnessScoreBanner />
            <div style={{ marginTop: "12px", fontSize: "14px", lineHeight: "1.6" }}>
              Connect with certified psychologists, manage your upcoming counselling sessions, and track your wellness journey.
            </div>
          </BentoCard>

          <DailyQuoteCard />
          <FlashQACard />
          <MoodTrackerCard />

          <GamesSummaryCard onPlay={() => setActiveSection("games")} />
          <UpcomingEventsCard onViewEvents={() => setActiveSection("events")} />

          <UserHomeActivityOverview onSelectSection={setActiveSection} />
          <VishnuWellnessMissionCard onSelectSection={setActiveSection} />
        </div>
      )}
    </AppShell>
  );
}


