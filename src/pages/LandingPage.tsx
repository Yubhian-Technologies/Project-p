import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { dashboardPathForRole } from "../utils/roleRedirect";
import "./LandingPage.css";

export function LandingPage() {
  const { currentUser, role } = useAuth();
  const dashboardPath = dashboardPathForRole(role);

  return (
    <div className="landing-wrapper">
      {/* Fullscreen Atmospheric Background Image & Overlay */}
      <div className="landing-bg" />
      <div className="landing-bg-overlay" />

      {/* Main Glass Panel */}
      <main className="landing-glass-panel">
        {/* Top Glass Navigation */}
        <header className="landing-nav">
          <Link to="/" className="landing-brand">
            <img src="/favicon.png" alt="Vishnu Universal Learning logo" className="landing-brand__logo" />
            <span className="landing-brand__name">Vishnu Wellness</span>
          </Link>

          <ul className="landing-nav__links">
            <li><a href="#about" className="landing-nav__link">About</a></li>
            <li><a href="#features" className="landing-nav__link">Features</a></li>
            <li><a href="#resources" className="landing-nav__link">Resources</a></li>
          </ul>

          <div className="landing-nav__actions">
            {currentUser ? (
              <Link to={dashboardPath} className="btn-glass-primary">
                Dashboard &rarr;
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn-glass-subtle">
                  Sign In
                </Link>
                <Link to="/signup" className="btn-glass-primary">
                  Sign Up &rarr;
                </Link>
              </>
            )}
          </div>
        </header>

        {/* Hero Photo Placeholder Banner */}
        <div className="hero-photo-banner">
          <div className="hero-photo-banner__inner">
            <svg className="hero-photo-banner__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="4" ry="4" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span className="hero-photo-banner__label">Insert calm wellness imagery here</span>
          </div>
        </div>

        {/* Hero Section */}
        <section className="landing-hero">
          <h1 className="landing-headline">
            Elevate Your Mind, Body & Soul. <br />
            <span className="landing-headline__gradient">Redefined.</span>
          </h1>

          <p className="landing-subtitle">
            Book 1-on-1 sessions with certified psychologists, track your personal wellness journey, and receive dedicated counselling support—all in one seamless workspace.
          </p>

          <div className="landing-hero__ctas">
            <Link to={currentUser ? dashboardPath : "/signup"} className="btn-glass-primary btn-hero-primary">
              Book Session &rarr;
            </Link>
          </div>
        </section>

        {/* Floating Product Preview Showcase */}
        <div className="landing-preview-viewport">
          {/* Floating Left Widget */}
          <div className="floating-widget floating-widget--left">
            <div className="widget-icon">
              <svg viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </div>
            <div className="widget-text">
              <div className="widget-text__title">Mindfulness Score</div>
              <div className="widget-text__value">98% &bull; Wellbeing Index</div>
            </div>
          </div>

          {/* Central Main Preview Card */}
          <div className="preview-main-card">
            <div className="preview-bar">
              <div className="preview-bar__dots">
                <div className="preview-bar__dot" />
                <div className="preview-bar__dot" />
                <div className="preview-bar__dot" />
              </div>
              <div className="preview-bar__search">
                <span>vishnuwellness.com/counselling</span>
              </div>
            </div>

            <div className="preview-content-grid">
              <div className="preview-sidebar">
                <div className="preview-item preview-item--short" />
                <div className="preview-item preview-item--medium" />
                <div className="preview-item preview-item--short" />
                <div className="preview-item preview-item--medium" />
              </div>

              <div className="preview-main-panel">
                <div style={{ color: '#64748b', fontSize: '12px' }}>
                  Upcoming Session • 1-on-1 Counselling
                </div>
                <div className="preview-prompt-box">
                  <span>"Dr. Ananya Sharma — Mindfulness & Stress Relief Session"</span>
                  <span className="preview-pill">Join Session</span>
                </div>
              </div>
            </div>
          </div>

          {/* Floating Right Widget */}
          <div className="floating-widget floating-widget--right">
            <div className="widget-icon">
              <svg viewBox="0 0 24 24">
                <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z" />
              </svg>
            </div>
            <div className="widget-text">
              <div className="widget-text__title">1-on-1 Counselling</div>
              <div className="widget-text__value">Certified Psychologists</div>
            </div>
          </div>
        </div>

        {/* About / Guidelines Section with Floating Photos */}
        <section className="landing-about" id="about">
          <div className="landing-about__text">
            <span className="landing-about__eyebrow">About Vishnu Wellness</span>
            {/* Placeholder copy — replace with real content */}
            <h2 className="landing-about__title">
              A calm, judgment-free space to work through what's on your mind
            </h2>
            <p className="landing-about__body">
              Vishnu Wellness connects students and working professionals with licensed
              counsellors for private, one-on-one support. Every session follows a simple set
              of principles designed to keep the experience safe, consistent, and genuinely
              helpful.
            </p>
            <ul className="landing-about__guidelines">
              <li>100% confidential — your sessions stay between you and your counsellor</li>
              <li>Matched with licensed, certified mental health professionals</li>
              <li>Flexible scheduling that works around your routine</li>
              <li>A judgment-free space, every session</li>
            </ul>
          </div>

          <div className="landing-about__gallery">
            {/* Placeholder photo cards — swap the .about-photo-placeholder div inside each
                for <img src="/your-photo.jpg" alt="..." /> once real photos are provided. */}
            <div className="about-photo-card about-photo-card--1">
              <div className="about-photo-placeholder" />
            </div>
            <div className="about-photo-card about-photo-card--2">
              <div className="about-photo-placeholder" />
            </div>
            <div className="about-photo-card about-photo-card--3">
              <div className="about-photo-placeholder" />
            </div>
            <div className="about-photo-card about-photo-card--4">
              <div className="about-photo-placeholder" />
            </div>
          </div>
        </section>

        {/* Features Section — placeholder highlights, replace with real specifics */}
        <section className="landing-features" id="features">
          <div className="landing-section-heading">
            <span className="landing-about__eyebrow">Why Vishnu Wellness</span>
            <h2 className="landing-section-heading__title">Everything you need for your wellness journey</h2>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-card__icon">
                <svg viewBox="0 0 24 24">
                  <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                </svg>
              </div>
              <h3 className="feature-card__title">1-on-1 Video &amp; Chat Sessions</h3>
              <p className="feature-card__desc">Connect with your counsellor privately, on your schedule.</p>
            </div>

            <div className="feature-card">
              <div className="feature-card__icon">
                <svg viewBox="0 0 24 24">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1.2 14.6l-3.6-3.6 1.4-1.4 2.2 2.2 5-5 1.4 1.4-6.4 6.4z" />
                </svg>
              </div>
              <h3 className="feature-card__title">Licensed &amp; Verified Psychologists</h3>
              <p className="feature-card__desc">Every counsellor is vetted and certified before joining.</p>
            </div>

            <div className="feature-card">
              <div className="feature-card__icon">
                <svg viewBox="0 0 24 24">
                  <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
                </svg>
              </div>
              <h3 className="feature-card__title">Flexible Scheduling</h3>
              <p className="feature-card__desc">Book, reschedule, or follow up whenever it suits you.</p>
            </div>

            <div className="feature-card">
              <div className="feature-card__icon">
                <svg viewBox="0 0 24 24">
                  <path d="M12 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm6-9h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zM8 6a4 4 0 0 1 8 0v2H8V6z" />
                </svg>
              </div>
              <h3 className="feature-card__title">Confidential by Design</h3>
              <p className="feature-card__desc">Your sessions and details stay private, always.</p>
            </div>

            <div className="feature-card">
              <div className="feature-card__icon">
                <svg viewBox="0 0 24 24">
                  <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z" />
                </svg>
              </div>
              <h3 className="feature-card__title">Progress You Can Track</h3>
              <p className="feature-card__desc">Session history and follow-ups, all in one place.</p>
            </div>
          </div>
        </section>

        {/* Resources Section — generic placeholder labels, no invented real titles/authors */}
        <section className="landing-resources" id="resources">
          <div className="landing-section-heading">
            <span className="landing-about__eyebrow">Resources We Follow</span>
            <h2 className="landing-section-heading__title">Grounded in trusted guidelines and reading</h2>
          </div>

          <div className="resources-grid">
            <div className="resource-card">
              <span className="resource-card__tag">Recommended Reading</span>
              <h3 className="resource-card__title">Placeholder Book Title</h3>
              <p className="resource-card__desc">A short placeholder description of what this resource covers.</p>
            </div>

            <div className="resource-card">
              <span className="resource-card__tag">Clinical Guideline</span>
              <h3 className="resource-card__title">Placeholder Guideline Name</h3>
              <p className="resource-card__desc">The framework our counsellors follow during sessions.</p>
            </div>

            <div className="resource-card">
              <span className="resource-card__tag">Self-Help Resource</span>
              <h3 className="resource-card__title">Placeholder Resource Name</h3>
              <p className="resource-card__desc">A tool or worksheet used to support ongoing care.</p>
            </div>

            <div className="resource-card">
              <span className="resource-card__tag">Research &amp; Reference</span>
              <h3 className="resource-card__title">Placeholder Reference Title</h3>
              <p className="resource-card__desc">Background reading our approach is grounded in.</p>
            </div>
          </div>
        </section>

        {/* Footer Section with Social Media Icons */}
        <footer className="landing-footer">
          <div className="landing-footer__copy">
            &copy; 2026 Vishnu Wellness &bull; All rights reserved.
          </div>

          <div className="landing-social-links">
            {/* X / Twitter */}
            <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="social-icon-btn" aria-label="X (Twitter)">
              <svg viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>

            {/* Instagram */}
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="social-icon-btn" aria-label="Instagram">
              <svg viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </a>

            {/* LinkedIn */}
            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="social-icon-btn" aria-label="LinkedIn">
              <svg viewBox="0 0 24 24">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
              </svg>
            </a>

            {/* YouTube */}
            <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="social-icon-btn" aria-label="YouTube">
              <svg viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
