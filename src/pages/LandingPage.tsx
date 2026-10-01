import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { dashboardPathForRole } from "../utils/roleRedirect";
import "./LandingPage.css";

const FAQS = [
  {
    question: "What is counseling?",
    answer:
      "Counselling is a confidential, supportive conversation with a trained professional to help you understand your feelings, work through challenges, and build healthier ways of coping.",
  },
  {
    question: "Will my sessions be confidential?",
    answer:
      "Yes. Everything you share stays strictly between you and your counsellor, and is never disclosed to anyone else without your explicit consent — except in rare situations involving risk of harm to yourself or others.",
  },
  {
    question: "How many sessions will I have to attend?",
    answer:
      "There's no fixed number — it depends on your goals and progress. Some people find a few sessions helpful, while others continue over a longer period. Your counsellor will discuss a plan with you.",
  },
  {
    question: "Can I get a refund?",
    answer:
      "Refund eligibility depends on your enrollment/payment plan and how far in advance a session is cancelled. Reach out to our team and we'll review your specific case.",
  },
  {
    question: "Who is a counseling psychologist?",
    answer:
      "A counselling psychologist is a licensed mental health professional trained to help people manage everyday life challenges, emotional difficulties, and personal growth through talk-based therapy.",
  },
  {
    question: "Who is a clinical psychologist?",
    answer:
      "A clinical psychologist is trained to assess, diagnose, and treat more complex mental health conditions, often using evidence-based therapeutic approaches.",
  },
  {
    question: "Is it safe to take medications for mental health?",
    answer:
      "When prescribed and monitored by a qualified psychiatrist, mental health medications are safe and can be an effective part of treatment. Never start, stop, or adjust medication without medical guidance.",
  },
  {
    question: "Who is a psychiatrist?",
    answer:
      "A psychiatrist is a medical doctor who specialises in diagnosing and treating mental health conditions, and is qualified to prescribe medication when needed.",
  },
  {
    question: "How do I know if I need therapy?",
    answer:
      "If you're feeling persistently overwhelmed, anxious, low, or stuck — or just want a space to talk things through — therapy can help. You don't need a diagnosis to benefit from counselling.",
  },
  {
    question: "Is online therapy as effective as in-person therapy?",
    answer:
      "Research shows online therapy can be just as effective as in-person sessions for many concerns, while offering more flexibility and comfort.",
  },
  {
    question: "How can I prepare for my first session?",
    answer:
      "Come as you are — there's nothing you need to prepare. It can help to jot down what's been on your mind, but your counsellor will guide the conversation from there.",
  },
];

export function LandingPage() {
  const { currentUser, role } = useAuth();
  const dashboardPath = dashboardPathForRole(role);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

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
            <img src="/favicon.png" alt="Vishnu Wellness Center logo" className="landing-brand__logo" />
            <span className="landing-brand__name">Vishnu Wellness Center</span>
          </Link>

          <ul className="landing-nav__links">
            <li><a href="#about" className="landing-nav__link">About</a></li>
            <li><a href="#team" className="landing-nav__link">Our Team</a></li>
            <li><a href="#features" className="landing-nav__link">Features</a></li>
            <li><a href="#resources" className="landing-nav__link">Resources</a></li>
            <li><a href="#faq" className="landing-nav__link">FAQ</a></li>
            <li><a href="#terms" className="landing-nav__link">Terms and Policies</a></li>
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
              </>
            )}
          </div>
        </header>

        {/* Hero Photo Banner */}
        <div className="hero-photo-banner">
          <div className="hero-photo-banner__frame">
            <div className="hero-photo-banner__media">
              <img
                src="/hero-counsellor.jpg"
                alt="A counsellor and client talking together in a calm, plant-filled room"
                className="hero-photo-banner__image"
              />
              <div className="hero-photo-banner__overlay" />

              <section className="landing-hero">
                <h1 className="landing-headline">
                  Elevate Your Mind, Body &amp; Soul.{" "}
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
            </div>
          </div>
        </div>

        {/* Core Values Showcase */}
        <div className="landing-values">
          <div className="value-card value-card--1">
            <h3 className="value-card__title">Confidentiality</h3>
            <p className="value-card__desc">
              Everything you share stays strictly between you and your counsellor — private, secure, and never disclosed without your consent.
            </p>
          </div>

          <div className="value-card value-card--2">
            <h3 className="value-card__title">Empathy</h3>
            <p className="value-card__desc">
              Every session starts with genuinely listening — our counsellors meet you where you are, with warmth and understanding.
            </p>
          </div>

          <div className="value-card value-card--3">
            <h3 className="value-card__title">Non-judgemental</h3>
            <p className="value-card__desc">
              A safe space to share exactly as you are — no labels, no judgement, just support.
            </p>
          </div>
        </div>

        {/* About / Guidelines Section with Floating Photos */}
        <section className="landing-about" id="about">
          <div className="landing-about__text">
            <span className="landing-about__eyebrow">About Vishnu Wellness Center</span>
            {/* Placeholder copy — replace with real content */}
            <h2 className="landing-about__title">
              A calm, judgment-free space to work through what's on your mind
            </h2>
            <p className="landing-about__body">
              Vishnu Wellness Center connects students and working professionals with licensed
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
            <div className="about-photo-card about-photo-card--1">
              <img className="about-photo-card__image" src="/about-photo-1.jpg" alt="Positive psychology" />
            </div>
            <div className="about-photo-card about-photo-card--2">
              <img className="about-photo-card__image" src="/about-photo-2.jpg" alt="Mental wellness" />
            </div>
            <div className="about-photo-card about-photo-card--3">
              <img className="about-photo-card__image" src="/about-photo-3.webp" alt="Psychology concepts" />
            </div>
            <div className="about-photo-card about-photo-card--4">
              <img className="about-photo-card__image" src="/about-photo-4.webp" alt="Mental health awareness" />
            </div>
          </div>
        </section>

        {/* Our Team Section — placeholder overview copy, real content to be added later */}
        <section className="landing-team" id="team">
          <div className="landing-section-heading">
            <span className="landing-about__eyebrow">Our Team</span>
            <h2 className="landing-section-heading__title">The people behind Vishnu Wellness Center</h2>
          </div>

          <div className="team-overview-card">
            <p className="team-overview-card__body">
              Placeholder overview of our team as a whole — replace with real content describing
              our counsellors, their collective experience, and the approach they bring to care.
            </p>
          </div>
        </section>

        {/* Features Section — placeholder highlights, replace with real specifics */}
        <section className="landing-features" id="features">
          <div className="landing-section-heading">
            <span className="landing-about__eyebrow">Why Vishnu Wellness Center</span>
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
              <h3 className="feature-card__title">Certified Psychologists</h3>
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

        {/* FAQ Section */}
        <section className="landing-faq" id="faq">
          <div className="landing-section-heading">
            <span className="landing-about__eyebrow">FAQ</span>
            <h2 className="landing-section-heading__title">Questions people usually ask</h2>
          </div>

          <div className="faq-card">
            {FAQS.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div key={faq.question} className="faq-item">
                  <button
                    type="button"
                    className="faq-item__question"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                  >
                    <span>{faq.question}</span>
                    <span className={`faq-item__toggle ${isOpen ? "faq-item__toggle--open" : ""}`} aria-hidden="true">
                      +
                    </span>
                  </button>
                  {isOpen && <p className="faq-item__answer">{faq.answer}</p>}
                </div>
              );
            })}
          </div>

          <div className="landing-faq__more">
            <a href="#faq" className="btn-faq-more">
              Check out more FAQ&apos;s
            </a>
          </div>
        </section>

        {/* Terms and Policies Section */}
        <section className="landing-terms" id="terms">
          <div className="landing-section-heading">
            <span className="landing-about__eyebrow">Terms and Policies</span>
            <h2 className="landing-section-heading__title">Please review our terms before you begin</h2>
          </div>

          <div className="terms-card">
            <ol className="terms-list">
              <li>
                <strong>Confidentiality:</strong> All information shared during counselling sessions is strictly
                confidential and will not be disclosed to any third party without the individual's explicit consent,
                except in cases where there is a risk of harm to oneself or others.
              </li>
              <li>
                <strong>Eligibility:</strong> Counselling services are available to currently enrolled students,
                faculty, and staff of the university free of charge.
              </li>
              <li>
                <strong>Appointment Scheduling:</strong> Counselling sessions are available by appointment only.
                Walk-in appointments may be accommodated based on emergency and counsellor availability.
              </li>
              <li>
                <strong>Cancellation Policy:</strong> If you need to cancel or reschedule your appointment, please
                notify us at least 24 hours in advance to avoid any inconvenience.
              </li>
              <li>
                <strong>Duration of Sessions:</strong> Counselling sessions typically last 45 minutes unless
                otherwise arranged with your counsellor.
              </li>
              <li>
                <strong>Respectful Environment:</strong> Our wellness centre is committed to providing a safe,
                inclusive, and respectful environment for all individuals seeking support.
              </li>
              <li>
                <strong>Limits of Service:</strong> While our counsellors strive to provide effective support, it's
                important to note that counselling services may not be suitable for all concerns. Referrals to
                external resources or specialised professionals may be provided when appropriate.
              </li>
              <li>
                <strong>Code of Conduct:</strong> The clients are expected to adhere to the university's code of
                conduct during counselling sessions, respect the counsellor's professional boundaries, and refrain
                from any behaviour that may compromise the safety or comfort of others.
              </li>
              <li>
                <strong>Feedback and Concerns:</strong> We value your feedback and encourage open communication. If
                you have any concerns or suggestions regarding our services, please do not hesitate to contact us.
              </li>
              <li>
                <strong>Compliance with Laws and Ethical Standards:</strong> Our wellness centre operates in
                accordance with relevant laws and ethical guidelines governing mental health services, ensuring the
                highest standards of care and professionalism.
              </li>
            </ol>
          </div>
        </section>

        {/* Footer Section with Social Media Icons */}
        <footer className="landing-footer">
          <div className="landing-footer__copy">
            &copy; 2026 Vishnu Wellness Center &bull; All rights reserved.
          </div>

          <div className="landing-social-links">
            {/* Instagram */}
            <a href="https://www.instagram.com/vishnu_wellness_centre" target="_blank" rel="noopener noreferrer" className="social-icon-btn" aria-label="Instagram">
              <svg viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
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
