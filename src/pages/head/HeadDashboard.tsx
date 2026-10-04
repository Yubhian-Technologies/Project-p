import { useRef, useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { ProfileSection } from "../../components/layout/ProfileSection";
import { BentoCard } from "../../components/common/BentoCard";
import { Button } from "../../components/common/Button";
import { useAuth } from "../../hooks/useAuth";
import { BookingRequestsSection } from "../counsellor/BookingRequestsSection";
import { CounsellorFeedbackSection } from "../counsellor/CounsellorFeedbackSection";
import { SsiCollegeResultsSection } from "../../components/ssi/SsiCollegeResultsSection";
import { TeamManagementSection } from "./TeamManagementSection";
import { EventsProgramsSection } from "./EventsProgramsSection";
import { EmergencyAlertsSection } from "../../components/emergency/EmergencyAlertsSection";
import { TransferRequestsSection } from "./TransferRequestsSection";
import { CommunitySection } from "../user/community/CommunitySection";
import { TeamChatSection } from "../../components/chat/TeamChatSection";
import { CounsellorWorksheetSection } from "../../components/worksheets/CounsellorWorksheetSection";
import { MonthlyReportsSection } from "./MonthlyReportsSection";
import { TeamMonthlyReportsSection } from "./TeamMonthlyReportsSection";
import { FlashQASection } from "./FlashQASection";
import { GamesSection } from "../user/games/GamesSection";
import type { GamesSectionHandle } from "../user/games/GamesSection";
import { JournalSection } from "../user/journal/JournalSection";
import { HeadAnalyticsOverview } from "./HeadAnalyticsOverview";
import { HeadHomeActivityOverview } from "./HeadHomeActivityOverview";
import { SessionReportsSection } from "./SessionReportsSection";
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
    id: "ssi-results",
    label: "SSI Test Results",
    icon: (
      <svg viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="13" y2="16" /></svg>
    ),
  },
  {
    id: "team-management",
    label: "Team Management",
    icon: (
      <svg viewBox="0 0 24 24"><circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /><path d="M21 21v-2a4 4 0 0 0-3-3.87" /></svg>
    ),
  },
  {
    id: "session-reports",
    label: "Session Reports",
    icon: (
      <svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
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
    id: "counsellor-monthly-reports",
    label: "Monthly Reports",
    icon: (
      <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
    ),
  },
  {
    id: "monthly-reports",
    label: "Consolidated Reports",
    icon: (
      <svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
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
    id: "flash-qa",
    label: "Flash Q/A",
    icon: (
      <svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
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
    id: "emergency",
    label: "Emergency Alerts",
    variant: "urgent" as const,
    icon: (
      <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
    ),
  },
];

export function HeadDashboard() {
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
    if (notification.type === "transfer_requested") {
      setActiveSection("transfer-requests");
      return;
    }
    if (notification.type === "journal_entry_shared") {
      setActiveSection("journal");
      return;
    }
    if (notification.type === "monthly_report_uploaded") {
      setActiveSection("counsellor-monthly-reports");
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
    "ssi-results": "SSI Test Results",
    "team-management": "Team Management",
    "session-reports": "Session Reports",
    events: "Events & Programs",
    "transfer-requests": "Transfer Requests",
    "counsellor-monthly-reports": "Monthly Reports",
    "monthly-reports": "Consolidated Reports",
    games: "Wellness Exercise",
    "flash-qa": "Flash Q/A",
    journal: "Counselling Journal",
    community: "Wellness Community",
    emergency: "Emergency Alerts",
  };
  const title = titleBySection[activeSection] ?? "Head Dashboard";

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
      {activeSection === "ssi-results" && <SsiCollegeResultsSection />}
      {activeSection === "team-management" && (
        <TeamManagementSection onOpenTransferRequests={() => setActiveSection("transfer-requests")} />
      )}
      {activeSection === "session-reports" && <SessionReportsSection />}
      {activeSection === "events" && <EventsProgramsSection />}
      {activeSection === "transfer-requests" && <TransferRequestsSection />}
      {activeSection === "counsellor-monthly-reports" && <TeamMonthlyReportsSection />}
      {activeSection === "monthly-reports" && <MonthlyReportsSection />}
      {activeSection === "games" && <GamesSection ref={gamesRef} onActiveChange={setGameOpen} />}
      {activeSection === "flash-qa" && <FlashQASection />}
      {activeSection === "journal" && <JournalSection />}
      {activeSection === "community" && <CommunitySection />}
      {activeSection === "emergency" && <EmergencyAlertsSection />}
      {activeSection === "overview" && (
        <div className="bento-grid">
          <BentoCard
            span={12}
            variant="hero"
            title={`Welcome, ${profile?.displayName || profile?.email || "Department Head"}`}
            subtitle="Counselling Department Leadership & Team Oversight"
            action={{
              label: "View Team Management →",
              variant: "secondary",
              onClick: () => setActiveSection("team-management"),
            }}
          >
            <div style={{ fontSize: "14px", lineHeight: "1.6" }}>
              Monitor team workload, review cancellations, and oversee booking requests across your department.
            </div>
          </BentoCard>

          <HeadAnalyticsOverview />
          <HeadHomeActivityOverview onSelectSection={setActiveSection} />
        </div>
      )}
    </AppShell>
  );
}

