import { useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../../hooks/useAuth";
import { ROLE_LABELS } from "../../config/roles";
import { Button } from "../common/Button";
import { NotificationBell } from "../common/NotificationBell";
import { Sidebar } from "./Sidebar";
import type { SidebarSection } from "./Sidebar";
import type { Notification } from "../../types/notification";
import "./AppShell.css";

interface AppShellProps {
  title: string;
  headerAction?: ReactNode;
  sections: SidebarSection[];
  activeSection: string;
  onSelectSection: (id: string) => void;
  onNotificationClick?: (notification: Notification) => void;
  children: ReactNode;
}

export function AppShell({
  title,
  headerAction,
  sections,
  activeSection,
  onSelectSection,
  onNotificationClick,
  children,
}: AppShellProps) {
  const { profile, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-shell">
      <header className="app-shell__topbar">
        <div className="app-shell__topbar-inner">
          <div className="flex-row app-shell__topbar-left">
            <button
              type="button"
              className="app-shell__menu-toggle"
              aria-label="Toggle navigation"
              onClick={() => setSidebarOpen((open) => !open)}
            >
              ☰
            </button>
            <div className="app-shell__brand flex-row">
              <img src="/favicon.png" alt="Vishnu Wellness Center Logo" className="app-shell__logo" />
              <span>Vishnu Wellness Center</span>
            </div>
          </div>
          <div className="flex-row app-shell__topbar-right">
            {profile && (profile.role === "admin" || profile.role === "super-admin") && (
              <span className="app-shell__role-badge">{ROLE_LABELS[profile.role]}</span>
            )}
            {profile &&
              (profile.role === "user" || profile.role === "counsellor" || profile.role === "head") && (
                <NotificationBell onNotificationClick={onNotificationClick} />
              )}
            <Button variant="outlined" onClick={() => logout()}>
              Log out
            </Button>
          </div>
        </div>
      </header>
      <div className="app-shell__body">
        <Sidebar
          sections={sections}
          activeSection={activeSection}
          onSelectSection={onSelectSection}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="app-shell__content">
          {title && (
            <div className="app-shell__title-row">
              <h1 className="app-shell__title">{title}</h1>
              {headerAction && <div className="app-shell__title-action">{headerAction}</div>}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
