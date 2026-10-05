# Vishnu Wellness UI Design Principles & Design System

When generating, modifying, or styling UI components and web pages in this codebase, ALWAYS adhere to the following **Unified Landing Page & Dashboard Design System**:

---

## 1. Typography System (Playfair Display + Work Sans)
- **Display & Headlines:** `'Playfair Display', Georgia, 'Times New Roman', serif` (available via `var(--font-headline)`, `var(--font-title)`, and `var(--md-sys-typescale-font-display)`).
  - Used for hero headings, page titles, section titles, bento card headlines, and metric values.
  - Weight: 700 to 900.
- **Body, Navigation, UI Controls & Labels:** `'Work Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` (available via `var(--font-main)` and `var(--md-sys-typescale-font-body)`).
  - Used for body copy, paragraphs, table rows, button labels, chips, and metadata.
  - Weight: 400 (regular), 600 (semi-bold), 700 (bold), 800 (extra-bold).

---

## 2. Color Palette & Semantic Tokens

### Canvas & Surfaces
- **Canvas / Page Background:** `#FCFBF9` (`--neu-bg`, `--theme-bg`) — warm clean porcelain canvas.
- **Card Surfaces:** `#FFFFFF` (`--neu-surface`, `--theme-card-bg`) — pure white cards with hairline borders.
- **Hairline Borders:** `1px solid #E2E8F0` (`--sketch-border`) — subtle, crisp border defining card perimeters.
- **Input Borders & Dividers:** `#E2E8F0` / `#CBD5E1`.

### Brand & Interactive Accents
- **Primary Dark / Brand:** `#0B193C` (`--neu-accent-primary`, `--neu-accent-dark`, `--theme-lavender`) — deep midnight navy used for:
  - Active sidebar navigation pills (with `#FFFFFF` text).
  - Primary filled buttons (`.md-button--filled`, `.bento-btn--primary`).
  - Hero card background gradient: `linear-gradient(135deg, #0B193C 0%, #061330 100%)`.
  - Sent chat message bubbles (`.team-chat__bubble--mine`, `.chat-modal__bubble--mine`).
  - Section headers, table column titles, and active filter chips.
- **Primary Interactive Accent:** `#EA580C` (`--neu-accent-vivid`, `--neu-accent-orange`, `--theme-accent-orange`) — warm sunset orange used for:
  - Counter pill badges on active sidebar items.
  - Notification bell unread count badge & indicator dots.
  - Focus outlines & glow rings: `0 0 0 3px rgba(234, 88, 12, 0.2)`.
  - Interactive hover highlights, text links, and high score indicators.
- **Calming Secondary Accent:** `#0D9488` (`--neu-accent-teal`) / `#F0FDFA` — serene teal used for:
  - Breathing games, meditation rings, and wellness progress indicators.
- **Text Hierarchy:**
  - **Headings & Primary Text:** `#0F172A` (`--neu-text-primary`, `--theme-charcoal`, `--color-text-main`) — high-contrast dark slate.
  - **Body Copy:** `#334155` (`--neu-text-body`) — balanced readable slate.
  - **Muted Text & Captions:** `#64748B` (`--neu-text-muted`, `--theme-text-muted`) — slate gray.

---

## 3. Card Elevation & Shadows
- **Card Base Shadow:** `0 4px 20px -2px rgba(15, 23, 42, 0.07)` (`--neu-shadow-extruded`, `--sketch-shadow`).
- **Card Hover Shadow:** `0 14px 36px rgba(15, 23, 42, 0.1)` (`--neu-shadow-extruded-hover`, `--sketch-shadow-hover`).
- **Small Button / Icon Shadow:** `0 2px 8px rgba(15, 23, 42, 0.04)` (`--sketch-shadow-sm`).
- **Focus Ring Glow:** `0 0 0 3px rgba(234, 88, 12, 0.25)` (`--neu-shadow-sunken-focus`).

---

## 4. Bento Grid & Dashboard Architecture
- **Bento Grid Layout:** All 5 role-based dashboards (User, Counsellor, Head, Admin, Super Admin) utilize the responsive Bento Grid layout (`src/styles/bento-grid.css`) and `BentoCard` components.
- **Hero Bento Card (`.bento-card--hero`):**
  - Background: `linear-gradient(135deg, #0B193C 0%, #061330 100%)`.
  - Heading and body text in pure white `#FFFFFF` and `#CBD5E1`.
  - Secondary action button: `#FFFFFF` with `#0B193C` text, hovering to `#EA580C`.
- **Sidebar & Top Bar:**
  - Sidebar: Elevated card surface, border `#E2E8F0`, hover background `#F8FAFC`. Active tab: `#0B193C` with `#FFFFFF` text and `#EA580C` count badge.
  - Top Bar: Floating/sticky white surface with hairline border `#E2E8F0` and `#0F172A` role tag badge.

---

## 5. Strict Prohibitions
- **NEVER** use legacy purple (`#6D74D6`, `#5A61C0`, `#8F95E6`, `#EDE9FE`, `#F3E8FF`) in any dashboard or component.
- **NEVER** use muddy brown / charcoal brown (`#2E2B27`, `#F4F0E8`) for text or canvas backgrounds.
- **NEVER** use Tailwind CSS or Bootstrap unless explicitly requested by the user. Plain CSS with design tokens is the project standard.
