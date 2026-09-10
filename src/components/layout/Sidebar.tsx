import { useAuth } from "../../hooks/useAuth";
import { Avatar } from "../common/Avatar";
import "./Sidebar.css";

export interface SidebarSection {
  id: string;
  label: string;
  variant?: "urgent";
}

interface SidebarProps {
  sections: SidebarSection[];
  activeSection: string;
  onSelectSection: (id: string) => void;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ sections, activeSection, onSelectSection, open, onClose }: SidebarProps) {
  const { profile } = useAuth();

  function select(id: string) {
    onSelectSection(id);
    onClose();
  }

  return (
    <>
      {open && <div className="sidebar__scrim" onClick={onClose} />}
      <nav className={`sidebar ${open ? "sidebar--open" : ""}`}>
        <ul className="sidebar__list">
          {sections.map((section) => (
            <li key={section.id}>
              <button
                type="button"
                className={[
                  "sidebar__item",
                  activeSection === section.id ? "sidebar__item--active" : "",
                  section.variant === "urgent" ? "sidebar__item--urgent" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => select(section.id)}
              >
                {section.variant === "urgent" && <span className="sidebar__item-dot" aria-hidden="true" />}
                {section.label}
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className={`sidebar__item sidebar__profile ${activeSection === "profile" ? "sidebar__item--active" : ""}`}
          onClick={() => select("profile")}
        >
          <Avatar photoURL={profile?.photoURL} label={profile?.email ?? "?"} size="small" />
          Profile
        </button>
      </nav>
    </>
  );
}
