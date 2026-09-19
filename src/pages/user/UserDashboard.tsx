import { useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { ProfileSection } from "../../components/layout/ProfileSection";
import { BentoCard } from "../../components/common/BentoCard";
import { useAuth } from "../../hooks/useAuth";
import { BookingSection } from "./BookingSection";
import { WellnessTestSection } from "./WellnessTestSection";
import { GamesSection } from "./games/GamesSection";
import { GamesSummaryCard } from "./games/GamesSummaryCard";
import { JournalSection } from "./journal/JournalSection";
import { CommunitySection } from "./community/CommunitySection";
import { CrisisSosSection } from "./CrisisSosSection";
import { DailyQuoteCard } from "../../components/common/DailyQuoteCard";
import { FlashQACard } from "../../components/common/FlashQACard";
import { MoodTrackerCard } from "../../components/common/MoodTrackerCard";
import { WellnessScoreBanner } from "../../components/common/WellnessScoreBanner";
import { ChallengesCard } from "./games/ChallengesCard";
import { UserHomeActivityOverview } from "./UserHomeActivityOverview";
import { VishnuWellnessMissionCard } from "../../components/common/VishnuWellnessMissionCard";
import type { Notification } from "../../types/notification";
import "../../styles/bento-grid.css";

const SECTIONS = [
  { id: "overview", label: "Home" },
  { id: "booking", label: "Book Session" },
  { id: "wellness-test", label: "Wellness Test" },
  { id: "games", label: "Wellness Exercise" },
  { id: "journal", label: "Counselling Journal" },
  { id: "community", label: "Wellness Community" },
  { id: "crisis-sos", label: "Crisis SOS", variant: "urgent" as const },
];

export function UserDashboard() {
  const { profile } = useAuth();
  const [activeSection, setActiveSection] = useState("overview");
  const [chatBookingId, setChatBookingId] = useState<string | undefined>();

  function handleNotificationClick(notification: Notification) {
    setActiveSection("booking");
    if (notification.type === "chat_message") {
      setChatBookingId(notification.bookingId);
    }
  }

  const titleBySection: Record<string, string> = {
    profile: "Profile",
    booking: "Book Session",
    "wellness-test": "Wellness Stress Assessment",
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
      {activeSection === "booking" && (
        <BookingSection openChatBookingId={chatBookingId} onChatOpened={() => setChatBookingId(undefined)} />
      )}
      {activeSection === "wellness-test" && (
        <WellnessTestSection onBookSession={() => setActiveSection("booking")} />
      )}
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
            <WellnessScoreBanner />
            <div style={{ marginTop: "12px", fontSize: "14px", lineHeight: "1.6" }}>
              Connect with certified psychologists, manage your upcoming counselling sessions, and track your wellness journey.
            </div>
          </BentoCard>

          <DailyQuoteCard />
          <FlashQACard />
          <MoodTrackerCard />

          <BentoCard
            span={6}
            title="Take Wellness Stress Assessment"
            subtitle="Evaluate your stress level and get instant personalized suggestions."
            action={{
              label: "Start Test →",
              onClick: () => setActiveSection("wellness-test"),
            }}
          >
            <div style={{ fontSize: "13.5px", lineHeight: "1.5", color: "#4A5568" }}>
              Answer 6 quick questions to assess your current stress levels, receive actionable self-care tips, or schedule a session with a counsellor.
            </div>
          </BentoCard>

          <GamesSummaryCard onPlay={() => setActiveSection("games")} />

          <div style={{ gridColumn: "1 / -1", marginTop: "12px" }}>
            <ChallengesCard />
          </div>

          <UserHomeActivityOverview onSelectSection={setActiveSection} />
          <VishnuWellnessMissionCard onSelectSection={setActiveSection} />
        </div>
      )}
    </AppShell>
  );
}


