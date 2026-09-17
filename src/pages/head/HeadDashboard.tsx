import { useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { ProfileSection } from "../../components/layout/ProfileSection";
import { BentoCard } from "../../components/common/BentoCard";
import { Button } from "../../components/common/Button";
import { useAuth } from "../../hooks/useAuth";
import { BookingRequestsSection } from "../counsellor/BookingRequestsSection";
import { CounsellorFeedbackSection } from "../counsellor/CounsellorFeedbackSection";
import { TeamManagementSection } from "./TeamManagementSection";
import { EventsProgramsSection } from "./EventsProgramsSection";
import { EmergencyAlertsSection } from "../../components/emergency/EmergencyAlertsSection";
import { TransferRequestsSection } from "./TransferRequestsSection";
import { CommunitySection } from "../user/community/CommunitySection";
import { MonthlyReportsSection } from "./MonthlyReportsSection";
import { TeamReportsSection } from "./TeamReportsSection";
import { FlashQASection } from "./FlashQASection";
import { GamesSection } from "../user/games/GamesSection";
import { JournalSection } from "../user/journal/JournalSection";
import { HeadAnalyticsOverview } from "./HeadAnalyticsOverview";
import { HeadHomeActivityOverview } from "./HeadHomeActivityOverview";
import type { Notification } from "../../types/notification";
import "../../styles/bento-grid.css";

const SECTIONS = [
  { id: "overview", label: "Home" },
  { id: "requests", label: "Requests" },
  { id: "feedback", label: "My Feedback" },
  { id: "team-management", label: "Team Management" },
  { id: "events", label: "Events & Programs" },
  { id: "transfer-requests", label: "Transfer Requests" },
  { id: "monthly-reports", label: "Monthly Reports" },
  { id: "team-reports", label: "Team Reports" },
  { id: "games", label: "Wellness Exercise" },
  { id: "flash-qa", label: "Flash Q/A" },
  { id: "journal", label: "Counselling Journal" },
  { id: "community", label: "Wellness Community" },
  { id: "emergency", label: "Emergency Alerts", variant: "urgent" as const },
];

export function HeadDashboard() {
  const { profile } = useAuth();
  const [activeSection, setActiveSection] = useState("overview");
  const [showImport, setShowImport] = useState(false);
  const [pendingBookingId, setPendingBookingId] = useState<string | undefined>();

  function handleNotificationClick(notification: Notification) {
    if (notification.type === "emergency_sos") {
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
    setPendingBookingId(notification.bookingId);
    setActiveSection("requests");
  }

  const titleBySection: Record<string, string> = {
    profile: "Profile",
    requests: "Booking Requests",
    feedback: "My Feedback",
    "team-management": "Team Management",
    events: "Events & Programs",
    "transfer-requests": "Transfer Requests",
    "monthly-reports": "Monthly Reports",
    "team-reports": "Team Reports",
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
      {activeSection === "profile" && <ProfileSection />}
      {activeSection === "requests" && (
        <BookingRequestsSection
          importOpen={showImport}
          onImportClose={() => setShowImport(false)}
          initialSelectedId={pendingBookingId}
        />
      )}
      {activeSection === "feedback" && <CounsellorFeedbackSection />}
      {activeSection === "team-management" && <TeamManagementSection />}
      {activeSection === "events" && <EventsProgramsSection />}
      {activeSection === "transfer-requests" && <TransferRequestsSection />}
      {activeSection === "monthly-reports" && <MonthlyReportsSection />}
      {activeSection === "team-reports" && <TeamReportsSection />}
      {activeSection === "games" && <GamesSection />}
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

