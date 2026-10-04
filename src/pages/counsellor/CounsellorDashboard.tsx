import { useRef, useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { ProfileSection } from "../../components/layout/ProfileSection";
import { BentoCard } from "../../components/common/BentoCard";
import { Button } from "../../components/common/Button";
import { useAuth } from "../../hooks/useAuth";
import { BookingRequestsSection } from "./BookingRequestsSection";
import { EventsProgramsSection } from "./EventsProgramsSection";
import { CounsellorMonthlyReportsSection } from "./CounsellorMonthlyReportsSection";
import { CounsellorFeedbackSection } from "./CounsellorFeedbackSection";
import { SsiCollegeResultsSection } from "../../components/ssi/SsiCollegeResultsSection";
import { EmergencyAlertsSection } from "../../components/emergency/EmergencyAlertsSection";
import { CommunitySection } from "../user/community/CommunitySection";
import { TeamChatSection } from "../../components/chat/TeamChatSection";
import { CounsellorWorksheetSection } from "../../components/worksheets/CounsellorWorksheetSection";
import { TeamWorkloadSection } from "../../components/workload/TeamWorkloadSection";
import { AttendanceCheckCard } from "../../components/attendance/AttendanceCheckCard";
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
  {
    id: "overview",
    label: "Home",
    icon: (
      <svg viewBox="0 0 24 24"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" /><path d="M9 21V12h6v9" /></svg>
    ),
  },
  {
    id: "requests",
    label: "Requests",
    icon: (
      <svg viewBox="0 0 24 24"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>
    ),
  },
  {
    id: "team-chat",
    label: "Team Chat",
    icon: (
      <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
    ),
  },
  {
    id: "worksheets",
    label: "Counsellor Worksheet",
    icon: (
      <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
    ),
  },
  {
    id: "team-workload",
    label: "Team Workload",
    icon: (
      <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="3" x2="9" y2="21" /></svg>
    ),
  },
  {
    id: "ssi-results",
    label: "SSI Test Results",
    icon: (
      <svg viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="13" y2="16" /></svg>
    ),
  },
  {
    id: "monthly-reports",
    label: "Monthly Reports",
    icon: (
      <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
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
      <svg viewBox="0 0 24 24"><circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /><path d="M21 21v-2a4 4 0 0 0-3-3.87" /></svg>
    ),
  },
  {
    id: "emergency",
    label: "Emergency Alerts",
    variant: "urgent" as const,
    icon: (
      <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
    ),
  },
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
    if (notification.type === "emergency_sos" || notification.type === "emergency_sos_claimed") {
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
    if (notification.type === "team_chat_message") {
      setActiveSection("team-chat");
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
    "team-chat": "Team Chat",
    worksheets: "Counsellor Worksheet",
    "team-workload": "Team Workload",
    "ssi-results": "SSI Test Results",
    "monthly-reports": "Monthly Reports",
    events: "Events & Programs",
    games: "Wellness Exercise",
    journal: "Counselling Journal",
    community: "Wellness Community",
    emergency: "Emergency Alerts",
  };
  const title = activeSection === "overview" ? "" : (titleBySection[activeSection] ?? "");

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
      {activeSection === "team-chat" && <TeamChatSection />}
      {activeSection === "worksheets" && <CounsellorWorksheetSection />}
      {activeSection === "team-workload" && <TeamWorkloadSection />}
      {activeSection === "ssi-results" && <SsiCollegeResultsSection />}
      {activeSection === "monthly-reports" && <CounsellorMonthlyReportsSection />}
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
          <AttendanceCheckCard span={4} />
          <CounsellorOverview />
          <DailyQuoteCard />
          <GamesSummaryCard onPlay={() => setActiveSection("games")} />
          <CounsellorHomeActivityOverview onSelectSection={setActiveSection} />
        </div>
      )}
    </AppShell>
  );
}
