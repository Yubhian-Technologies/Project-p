import { useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { ProfileSection } from "../../components/layout/ProfileSection";
import { BentoCard } from "../../components/common/BentoCard";
import { useAuth } from "../../hooks/useAuth";
import { BookingSection } from "./BookingSection";
import { GamesSection } from "./games/GamesSection";
import { GamesSummaryCard } from "./games/GamesSummaryCard";
import { DailyQuoteCard } from "../../components/common/DailyQuoteCard";
import "../../styles/bento-grid.css";

const SECTIONS = [
  { id: "overview", label: "Home" },
  { id: "booking", label: "Booking" },
  { id: "games", label: "Games" },
];

export function UserDashboard() {
  const { profile } = useAuth();
  const [activeSection, setActiveSection] = useState("overview");

  const title =
    activeSection === "profile"
      ? "Profile"
      : activeSection === "booking" || activeSection === "games"
        ? ""
        : "User Dashboard";

  return (
    <AppShell title={title} sections={SECTIONS} activeSection={activeSection} onSelectSection={setActiveSection}>
      {activeSection === "profile" && <ProfileSection />}
      {activeSection === "booking" && <BookingSection />}
      {activeSection === "games" && <GamesSection />}
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
