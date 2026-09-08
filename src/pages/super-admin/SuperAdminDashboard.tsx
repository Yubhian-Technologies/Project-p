import { useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { ProfileSection } from "../../components/layout/ProfileSection";
import { BentoCard } from "../../components/common/BentoCard";
import { useAuth } from "../../hooks/useAuth";
import { CampusManagementSection } from "./CampusManagementSection";
import "../../styles/bento-grid.css";

const SECTIONS = [
  { id: "overview", label: "Home" },
  { id: "campuses", label: "Campuses" },
];

const TITLES: Record<string, string> = {
  profile: "Profile",
  campuses: "Campuses",
};

export function SuperAdminDashboard() {
  const { profile } = useAuth();
  const [activeSection, setActiveSection] = useState("overview");

  return (
    <AppShell
      title={TITLES[activeSection] ?? "Super Admin Dashboard"}
      sections={SECTIONS}
      activeSection={activeSection}
      onSelectSection={setActiveSection}
    >
      {activeSection === "profile" ? (
        <ProfileSection />
      ) : activeSection === "campuses" ? (
        <CampusManagementSection />
      ) : (
        <div className="bento-grid">
          <BentoCard
            span={12}
            variant="hero"
            title={`Welcome, ${profile?.displayName || profile?.email || "Super Admin"}`}
            subtitle="Global Platform Governance & Control"
          >
            <div style={{ marginTop: "16px", fontSize: "14px", lineHeight: "1.6" }}>
              Full system-level administration, access policy controls, and platform-wide governance.
            </div>
          </BentoCard>
        </div>
      )}
    </AppShell>
  );
}
