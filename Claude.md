# Project Name

**Vishnu Wellness Psychology Maintenance App**

A psychology and wellness platform designed to connect **students and working professionals with psychologists/counsellors**. The platform will provide separate role-based dashboards for users, counsellors, heads, admins, and super admins.

## Tech Stack

* **Language:** TypeScript
* **Frontend:** React + TypeScript with Vite
* **Routing:** React Router
* **Styling:** Plain CSS with Glassmorphism & Bento Grid Systems (`src/styles/glassmorphism.css`, `src/styles/bento-grid.css`)
* **Typography:** `Plus Jakarta Sans` + `Inter` + `General Sans` + `Satoshi`
* **Backend/Database:** Firebase

  * Firebase Authentication
  * Cloud Firestore
  * Firebase Storage


## Core Commands

### Development & Build

* Install dependencies: `npm install`
* Run local development server: `npm run dev`
* Build project: `npm run build`
* Preview production build: `npm run preview`

### Testing & Quality

* Run tests: `npm test`
* Linting: `npm run lint`

Use the commands that are available in the project's `package.json`. Do not add unnecessary tools or dependencies unless required.

## Coding Standards & Rules

* Always use strict TypeScript types.
* Avoid `any` unless absolutely necessary.
* Use functional React components with hooks.
* Use React Router for application routing.
* Use reusable components instead of duplicating UI code.
* Use plain CSS and core glassmorphism & Bento Grid tokens for styling.
* Keep the UI responsive for mobile, tablet, laptop, and desktop.
* Never hardcode API keys, credentials, or sensitive configuration.
* Use Vite environment variables for Firebase configuration.
* Never store passwords manually in Firestore.
* Use Firebase Authentication for authentication.
* Keep Firebase-related logic organized and reusable.
* Follow secure Firebase Firestore Security Rules.
* Never rely only on frontend UI or route protection for authorization.
* Keep role-based permissions centralized and maintainable.
* Do not create a separate Express, Node.js, FastAPI, or Django backend.
* Do not introduce Tailwind CSS, Bootstrap, or other CSS frameworks unless explicitly requested.
* Keep components small, readable, and maintainable.
* Do not unnecessarily modify or delete existing working code.
* Before making major architectural changes, explain the change and its purpose.

## User Roles

The application has five primary roles:

1. **User** — Students and working professionals
2. **Counsellor / Psychologist** — Mental wellness professionals
3. **Head** — Higher-level management
4. **Admin** — Platform administration
5. **Super Admin** — Highest-level platform management

Each role has its own **Bento Grid** dashboard and permissions.

## Project Structure

```text
/src
  /components
    /common
      BentoCard.tsx
    /layout
      AppShell.tsx

  /pages
    LandingPage.tsx
      Refined Light Glassmorphism Landing Page

    /user
      UserDashboard.tsx (Bento Grid)

    /counsellor
      CounsellorDashboard.tsx (Bento Grid)

    /head
      HeadDashboard.tsx (Bento Grid)

    /admin
      AdminDashboard.tsx (Bento Grid)

    /super-admin
      SuperAdminDashboard.tsx (Bento Grid)

    /auth
      Authentication-related pages (Login, Signup)

  /routes
    Application routes and protected routes

  /context
    Global React contexts such as authentication

  /hooks
    Reusable custom React hooks

  /services
    /firebase
      Firebase-related services

  /types
    TypeScript types and interfaces

  /utils
    Utility and helper functions

  /config
    Application and Firebase configuration

  /styles
    glassmorphism.css (Glass design tokens & keyframes)
    bento-grid.css (Bento Grid layout system & font tokens)
    Global and shared CSS

  App.tsx
  main.tsx

/public
  bg_watercolor.jpg (User Indigo Watercolor Mountain Artwork)
  Static public assets

/docs
  Project documentation and reference materials

.env
.env.example
.gitignore
package.json
vite.config.ts
tsconfig.json
```

## UI/UX Design Principles

The application enforces a **Refined Light Glassmorphism & Bento Grid UI Architecture**:

* **4-Font Typography System:**
  * **Hero & Display Headlines:** `'Satoshi'`, `'General Sans'`, `'Plus Jakarta Sans'`, `'Inter'`
  * **Card & Section Titles:** `'General Sans'`, `'Satoshi'`, `'Plus Jakarta Sans'`, `'Inter'`
  * **Body Copy & UI Components:** `'Plus Jakarta Sans'`, `'Inter'`, `'General Sans'`, `'Satoshi'`

* **Visual Theme & Atmosphere:**
  * **Background:** Indigo watercolor mountain landscape artwork (`/bg_watercolor.jpg?v=2`).
  * **Glass Containers:** Translucent white glass panels (`rgba(255, 255, 255, 0.65)`), soft backdrop blur (`blur(20px)`), crisp light borders (`rgba(255, 255, 255, 0.95)`), and delicate shadows.
  * **Bento Grid Layout:** 12-column responsive grid featuring KPI counters, status badges, and action buttons.
  * **Color Tokens:** Deep indigo (`#1e3a8a`), slate text (`#0f172a`), and navy accents.

* **Performance & Smooth Motion:**
  * All micro-animations use GPU 3D hardware acceleration (`translate3d(0, y, 0)`) for 60fps/120fps smooth scrolling.