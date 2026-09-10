import { useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { ProfileSection } from "../../components/layout/ProfileSection";
import { BentoCard } from "../../components/common/BentoCard";
import { useAuth } from "../../hooks/useAuth";
import { BookingSection } from "./BookingSection";
import { GamesSection } from "./games/GamesSection";
import { GamesSummaryCard } from "./games/GamesSummaryCard";
import { JournalSection } from "./journal/JournalSection";
import { CommunitySection } from "./community/CommunitySection";
import { CrisisSosSection } from "./CrisisSosSection";
import { DailyQuoteCard } from "../../components/common/DailyQuoteCard";
import type { Notification } from "../../types/notification";
import "../../styles/bento-grid.css";

const SECTIONS = [
  { id: "overview", label: "Home" },
  { id: "booking", label: "Booking" },
  { id: "games", label: "Wellness Exercise" },
  { id: "journal", label: "Counselling Journal" },
  { id: "community", label: "Wellness Community" },
  { id: "crisis-sos", label: "Crisis SOS", variant: "urgent" as const },
];

export function UserDashboard() {
  const { profile } = useAuth();
  const [activeSection, setActiveSection] = useState("overview");

  function handleNotificationClick(_notification: Notification) {
    setActiveSection("booking");
  }

  const titleBySection: Record<string, string> = {
    profile: "Profile",
    booking: "Booking",
    games: "Wellness Exercise",
    journal: "Counselling Journal",
    community: "Wellness Community",
    "crisis-sos": "Crisis SOS",
  };
  const title = titleBySection[activeSection] ?? "User Dashboard";

  return (
    <AppShell
      title={title}
      sections={SECTIONS}
      activeSection={activeSection}
      onSelectSection={setActiveSection}
      onNotificationClick={handleNotificationClick}
    >
      {activeSection === "profile" && <ProfileSection />}
      {activeSection === "booking" && <BookingSection />}
      {activeSection === "games" && <GamesSection />}
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
            <div style={{ marginTop: "16px", fontSize: "14px", lineHeight: "1.6" }}>
              Connect with certified psychologists, manage your upcoming counselling sessions, and track your wellness journey.
            </div>
          </BentoCard>
          <GamesSummaryCard onPlay={() => setActiveSection("games")} />
          <DailyQuoteCard />
        </div>
      )}
    </AppShell>
  );
}
