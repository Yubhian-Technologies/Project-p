# Vishnu Wellness UI Design Principles & Typography Rules

When generating, modifying, or styling UI components and web pages in this codebase, ALWAYS adhere to the following **4-Font Typography System & Bento Grid Principles**:

## 1. Typography Rules
- **Font Stack:** **Plus Jakarta Sans** + **Inter** + **General Sans** + **Satoshi**.
- **Hero & Display Headlines:** Use `var(--font-headline)` (`'Satoshi', 'General Sans', 'Plus Jakarta Sans', 'Inter'`).
- **Dashboard Card & Section Titles:** Use `var(--bento-font-title)` (`'General Sans', 'Satoshi', 'Plus Jakarta Sans', 'Inter'`).
- **Body Copy, Navigation & UI Controls:** Use `var(--font-main)` / `var(--bento-font-body)` (`'Plus Jakarta Sans', 'Inter', 'General Sans', 'Satoshi'`).

## 2. Bento Grid UI & Glassmorphism Surfaces
- **Bento Grid Architecture:** All 5 role-based dashboards use the 12-column Bento Grid layout (`src/styles/bento-grid.css`) and `BentoCard` components.
- **Glass Panel Styling:** Use translucent glass panels with `background: rgba(255, 255, 255, 0.65)`, `backdrop-filter: blur(20px)`, clean border `rgba(255, 255, 255, 0.95)`, and shadow `0 30px 60px -12px rgba(15, 23, 42, 0.14)`.
- **Background Artwork:** Indigo watercolor mountain landscape image (`/bg_watercolor.jpg?v=2`).

## 3. High-Performance GPU Acceleration
- **Fixed Layering:** Keep `.landing-bg` fixed with `transform: translate3d(0, 0, 0)` to prevent scroll repaints.
- **Performant Blur:** Use 3D hardware-accelerated transforms for 60fps/120fps smooth scrolling performance.

## 4. Reference
- See `src/styles/glassmorphism.css` and `src/styles/bento-grid.css` for CSS variables and `Claude.md` for overall repo guidelines.
