import { useRef, useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { ProfileSection } from "../../components/layout/ProfileSection";
import { BentoCard } from "../../components/common/BentoCard";
import { Button } from "../../components/common/Button";
import { useAuth } from "../../hooks/useAuth";
import { BookingRequestsSection } from "./BookingRequestsSection";
import { EventsProgramsSection } from "./EventsProgramsSection";
import { WorkReportsSection } from "./WorkReportsSection";
import { CounsellorFeedbackSection } from "./CounsellorFeedbackSection";
import { EmergencyAlertsSection } from "../../components/emergency/EmergencyAlertsSection";
import { CommunitySection } from "../user/community/CommunitySection";
import { GamesSection } from "../user/games/GamesSection";
import type { GamesSectionHandle } from "../user/games/GamesSection";
import { GamesSummaryCard } from "../user/games/GamesSummaryCard";
import { JournalSection } from "../user/journal/JournalSection";
import { CounsellorOverview } from "./CounsellorOverview";
import { DailyQuoteCard } from "../../components/common/DailyQuoteCard";
import { CounsellorHomeActivityOverview } from "./CounsellorHomeActivityOverview";
import type { Notification } from "../../types/notification";
import "../../styles/bento-grid.css";

const SECTIONS = [
  { id: "overview", label: "Home" },
  { id: "requests", label: "Requests" },
  { id: "work-reports", label: "Work Reports" },
  { id: "events", label: "Events & Programs" },
  { id: "games", label: "Wellness Exercise" },
  { id: "journal", label: "Counselling Journal" },
  { id: "community", label: "Wellness Community" },
  { id: "emergency", label: "Emergency Alerts", variant: "urgent" as const },
];

export function CounsellorDashboard() {
  const { profile } = useAuth();
  const [activeSection, setActiveSection] = useState("overview");
  const [showImport, setShowImport] = useState(false);
  const [pendingBookingId, setPendingBookingId] = useState<string | undefined>();
  const [chatBookingId, setChatBookingId] = useState<string | undefined>();
  const gamesRef = useRef<GamesSectionHandle>(null);
  const [gameOpen, setGameOpen] = useState(false);

  function handleNotificationClick(notification: Notification) {
    if (notification.type === "emergency_sos") {
      setActiveSection("emergency");
      return;
    }
    if (notification.type === "feedback_submitted") {
      setActiveSection("feedback");
      return;
    }
    if (notification.type === "journal_entry_shared") {
      setActiveSection("journal");
      return;
    }
    if (notification.type === "chat_message") {
      setChatBookingId(notification.bookingId);
    }
    setPendingBookingId(notification.bookingId);
    setActiveSection("requests");
  }

  const titleBySection: Record<string, string> = {
    profile: "Profile",
    requests: "Booking Requests",
    feedback: "My Feedback",
    "work-reports": "Work Reports",
    events: "Events & Programs",
    games: "Wellness Exercise",
    journal: "Counselling Journal",
    community: "Wellness Community",
    emergency: "Emergency Alerts",
  };
  const title = titleBySection[activeSection] ?? "Counsellor Dashboard";

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
      headerAction={
        activeSection === "requests" ? (
          <Button type="button" variant="outlined" onClick={() => setShowImport(true)}>
            Import Sessions
          </Button>
        ) : undefined
      }
      sections={SECTIONS}
      activeSection={activeSection}
      onSelectSection={setActiveSection}
      onNotificationClick={handleNotificationClick}
    >
      {activeSection === "profile" && (
        <ProfileSection onOpenFeedback={() => setActiveSection("feedback")} />
      )}
      {activeSection === "requests" && (
        <BookingRequestsSection
          importOpen={showImport}
          onImportClose={() => setShowImport(false)}
          initialSelectedId={pendingBookingId}
          autoOpenChatBookingId={chatBookingId}
          onChatAutoOpenConsumed={() => setChatBookingId(undefined)}
        />
      )}
      {activeSection === "feedback" && <CounsellorFeedbackSection />}
      {activeSection === "work-reports" && <WorkReportsSection />}
      {activeSection === "events" && <EventsProgramsSection />}
      {activeSection === "games" && <GamesSection ref={gamesRef} onActiveChange={setGameOpen} />}
      {activeSection === "journal" && <JournalSection />}
      {activeSection === "community" && <CommunitySection />}
      {activeSection === "emergency" && <EmergencyAlertsSection />}
      {activeSection === "overview" && (
        <div className="bento-grid">
          <BentoCard
            span={12}
            variant="hero"
            title={`Welcome, ${profile?.displayName || profile?.email || "Counsellor"}`}
            subtitle="Certified Psychologist & Counsellor Workspace"
            action={{
              label: "Review Booking Requests →",
              variant: "secondary",
              onClick: () => setActiveSection("requests"),
            }}
          >
            <div style={{ fontSize: "14px", lineHeight: "1.6" }}>
              Review incoming session requests, update your availability, and manage your upcoming sessions.
            </div>
          </BentoCard>
          <CounsellorOverview />
          <DailyQuoteCard />
          <GamesSummaryCard onPlay={() => setActiveSection("games")} />
          <CounsellorHomeActivityOverview onSelectSection={setActiveSection} />
        </div>
      )}
    </AppShell>
  );
}
