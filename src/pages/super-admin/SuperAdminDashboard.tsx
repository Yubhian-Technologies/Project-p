import { useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { ProfileSection } from "../../components/layout/ProfileSection";
import { BentoCard } from "../../components/common/BentoCard";
import { useAuth } from "../../hooks/useAuth";
import { CampusManagementSection } from "./CampusManagementSection";
import { LoginsManagementSection } from "./LoginsManagementSection";
import { UsersManagementSection } from "./UsersManagementSection";
import { AdminsManagementSection } from "./AdminsManagementSection";
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
    id: "campuses",
    label: "Campuses",
    icon: (
      <svg viewBox="0 0 24 24"><path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /><path d="M9 9h1" /><path d="M9 13h1" /><path d="M9 17h1" /></svg>
    ),
  },
  {
    id: "logins",
    label: "Logins",
    icon: (
      <svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
    ),
  },
  {
    id: "users",
    label: "Users",
    icon: (
      <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 1 0-16 0" /></svg>
    ),
  },
  {
    id: "admins",
    label: "Admins",
    icon: (
      <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 1 0-16 0" /><path d="M16 3.5a4 4 0 0 1 0 7.5" /></svg>
    ),
  },
];

const TITLES: Record<string, string> = {
  profile: "Profile",
  campuses: "Campuses",
  logins: "Logins",
  users: "Users",
  admins: "Admins",
};

export function SuperAdminDashboard() {
  const { profile } = useAuth();
  const [activeSection, setActiveSection] = useState("overview");

  return (
    <AppShell
      title={activeSection === "overview" ? "" : (TITLES[activeSection] ?? "")}
      sections={SECTIONS}
      activeSection={activeSection}
      onSelectSection={setActiveSection}
    >
      {activeSection === "profile" ? (
        <ProfileSection />
      ) : activeSection === "campuses" ? (
        <CampusManagementSection />
      ) : activeSection === "logins" ? (
        <LoginsManagementSection />
      ) : activeSection === "users" ? (
        <UsersManagementSection />
      ) : activeSection === "admins" ? (
        <AdminsManagementSection />
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
