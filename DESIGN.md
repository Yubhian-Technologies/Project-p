# Vishnu Wellness — Design System Specification (DESIGN.md)

This document serves as the comprehensive design system specification for the **Vishnu Wellness Psychology Maintenance Platform**. All public-facing pages, authentication flows, and role-based dashboards (User/Student, Counsellor, Head of Department, Admin, Super Admin) must strictly adhere to these specifications.

---

## 1. Visual Philosophy & Core Aesthetics

The Vishnu Wellness design language combines **warm, serene porcelain canvases** with **crisp, high-contrast midnight navy surfaces** and **energetic sunset orange accents**. It eliminates generic AI aesthetics and muddy enterprise palettes in favor of a bespoke, editorial, wellness-centered experience.

### Key Pillars:
1. **Warm Clean Porcelain Canvas**: Eliminates harsh pure-gray `#F4F0E8` or clinical white backgrounds. Uses `#FCFBF9` to establish warmth and serenity.
2. **Elevated Porcelain & White Cards**: Pure white card surfaces bordered by crisp `#E2E8F0` hairline borders and diffused slate drop shadows (`rgba(15, 23, 42, 0.07)`).
3. **Midnight Navy Authority**: `#0B193C` provides commanding contrast for primary buttons, active navigation states, and hero gradient containers.
4. **Sunset Orange Vitality**: `#EA580C` is reserved for intentional interactive accents: counter badges, focus rings, notification indicators, and hover feedback.
5. **Serene Wellness Teal**: `#0D9488` is used for mindfulness modules (breathing exercises, meditation timers, and progress rings).

---

## 2. Typography System

The application uses a distinctive editorial serif paired with a modern geometric sans-serif:

| Role | Font Family | CSS Variable | Fallbacks | Weights | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display / Headlines** | `'Playfair Display'` | `var(--font-headline)` / `var(--md-sys-typescale-font-display)` | Georgia, serif | 700, 800, 900 | Hero titles, dashboard section titles, bento headlines, metric values |
| **Body & UI Controls** | `'Work Sans'` | `var(--font-main)` / `var(--md-sys-typescale-font-body)` | -apple-system, sans-serif | 400, 600, 700, 800 | Body text, tables, navigation, buttons, inputs, chips, captions |

*Note: All fonts are loaded centrally in `index.html` to eliminate redundant `@import` statements and optimize FCP.*

---

## 3. Color Palette & Token Reference

### Canvas & Surfaces
| Token | Hex Value | CSS Variable | Description |
| :--- | :--- | :--- | :--- |
| **Canvas Background** | `#FCFBF9` | `--neu-bg`, `--theme-bg` | Warm porcelain background across the whole viewport |
| **Card Surface** | `#FFFFFF` | `--neu-surface`, `--theme-card-bg` | Crisp pure white surface for Bento cards, modals, dropdowns |
| **Hairline Border** | `#E2E8F0` | `--sketch-border`, `--md-sys-color-outline` | 1px border perimeter for cards, tables, and inputs |
| **Thick Border** | `#CBD5E1` | `--sketch-border-thick` | Emphasized dividers and active borders |

### Brand & Accents
| Token | Hex Value | CSS Variable | Description |
| :--- | :--- | :--- | :--- |
| **Midnight Navy** | `#0B193C` | `--neu-accent-primary`, `--theme-lavender` | Primary action buttons, active sidebar tab, hero gradient start |
| **Darkest Navy** | `#061330` | `--neu-accent-dark` | Hero card gradient end |
| **Navy Hover** | `#142858` | `--neu-accent-hover` | Hover state for filled primary buttons |
| **Sunset Orange** | `#EA580C` | `--neu-accent-vivid`, `--theme-accent-orange` | Pill counter badges, focus glows, notification dots |
| **Peach Tint** | `#FFF7ED` | `--neu-accent-light`, `--theme-lavender-subtle` | Light warm hover background for icon buttons & options |
| **Serene Teal** | `#0D9488` | `--neu-accent-teal` | Calming indicators, breathing exercises, meditation ring |
| **Teal Light** | `#F0FDFA` | `--neu-accent-teal-light` | Background tint for calming wellness exercises |

### Text Hierarchy
| Level | Hex Value | CSS Variable | Usage |
| :--- | :--- | :--- | :--- |
| **Primary Text** | `#0F172A` | `--neu-text-primary`, `--theme-charcoal`, `--color-text-main` | High-contrast headings, page titles, active labels |
| **Body Copy** | `#334155` | `--neu-text-body` | Paragraphs, descriptions, readable content |
| **Muted Text** | `#64748B` | `--neu-text-muted`, `--theme-text-muted` | Subtitles, helper text, timestamps, table column headers |

---

## 4. Elevation, Radii & Shadows

### Border Radii
- **Full Pill / Circular:** `9999px` (`--radius-pill`, `--md-sys-shape-corner-full`) — Buttons, badges, counter pills, tabs.
- **Card Large:** `20px` (`--sketch-radius`, `--radius-md`, `--md-sys-shape-corner-large`) — Bento cards, modals, popups.
- **Surface Medium:** `14px`–`16px` (`--radius-lg`, `--md-sys-shape-corner-medium`) — Input fields, table wrappers, dialogs.
- **Small Elements:** `8px`–`12px` (`--md-sys-shape-corner-small`) — Inner chips, badges, tooltips.

### Shadow Scale
```css
/* Card Elevation */
--sketch-shadow-sm: 0 2px 8px rgba(15, 23, 42, 0.04);
--sketch-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.07);
--sketch-shadow-lg: 0 10px 30px rgba(15, 23, 42, 0.08);
--sketch-shadow-hover: 0 14px 36px rgba(15, 23, 42, 0.1);

/* Interactive Focus Glow */
--focus-ring: 0 0 0 3px rgba(234, 88, 12, 0.25);
```

---

## 5. Component Patterns

### 1. Bento Card (`.bento-card`)
- Background: `#FFFFFF`
- Border: `1px solid #E2E8F0`
- Border Radius: `20px`
- Box Shadow: `0 4px 20px -2px rgba(15, 23, 42, 0.07)`
- Hover: Soft lift (`translateY(-2px)`), shadow transitions to `0 14px 36px rgba(15, 23, 42, 0.1)`.

### 2. Hero Overview Card (`.bento-card--hero`)
- Background: `linear-gradient(135deg, #0B193C 0%, #061330 100%)`
- Text Color: `#FFFFFF` with subtitle `#CBD5E1`
- Primary Action: Sunset orange `#EA580C` or white pill button
- Secondary Action: Clean translucent white `#FFFFFF` button with `#0B193C` text, hovering to `#EA580C`.

### 3. Sidebar Navigation (`.app-shell__sidebar`)
- Surface: Elevated white `#FFFFFF` with hairline right border `#E2E8F0`.
- Inactive Item: `#334155` text, hover background `#F8FAFC`.
- Active Item: `#0B193C` pill background, `#FFFFFF` text.
- Counter Pill Badge: `#EA580C` with pure white bold text.

### 4. Form Controls & Inputs
- Inputs, selects, and textareas use white `#FFFFFF` background with `1px solid #E2E8F0`.
- Focus State: `outline: none; border-color: #EA580C; box-shadow: 0 0 0 3px rgba(234, 88, 12, 0.2);`.

### 5. Chat & Messenger Bubbles
- Sent Messages (`.team-chat__bubble--mine`, `.chat-modal__bubble--mine`): `#0B193C` background with `#FFFFFF` text.
- Received Messages (`.team-chat__bubble--them`): `#FFFFFF` background with `#0F172A` text and `#E2E8F0` border.

---

## 6. Prohibited Practices & Legacy Deprecation
- **NO Purple Accents**: Deprecated legacy hex codes (`#6D74D6`, `#5A61C0`, `#8F95E6`, `#EDE9FE`, `#F3E8FF`) must never be reintroduced.
- **NO Muddy Charcoal**: Deprecated `#2E2B27` and `#F4F0E8` are strictly replaced by `#0F172A` and `#FCFBF9`.
- **NO Third-Party CSS Frameworks**: Tailwind CSS, Bootstrap, or other CSS frameworks are strictly disallowed unless explicitly requested.
