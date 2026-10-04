import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { dashboardPathForRole } from "../utils/roleRedirect";
import { CardFanCarousel } from "../components/ui/CardFanCarousel";
import { PerspectiveDeckCarousel } from "../components/ui/PerspectiveDeckCarousel";
import "./LandingPage.css";

const ABOUT_CARDS = [
  {
    id: 1,
    title: "Positive Psychology",
    subtitle: "Mindset & Growth",
    imageUrl: "/about-photo-1.jpg",
  },
  {
    id: 2,
    title: "Cognitive Balance",
    subtitle: "Brain & Emotion",
    imageUrl: "/about-photo-2.jpg",
  },
  {
    id: 3,
    title: "Mental Wellness",
    subtitle: "Evidence-Based",
    imageUrl: "/about-photo-3.webp",
  },
  {
    id: 4,
    title: "Clarity & Healing",
    subtitle: "Guided Discovery",
    imageUrl: "/about-photo-4.webp",
  },
];

const TEAM_CARDS = [
  {
    imgUrl: "/team/counsellor-1.jpg",
    name: "Ram Prudhvi Teja",
    role: "Senior Wellness Counsellor • Author • Mind-Body Therapist",
    institution: "Vishnu Institute of Technology",
    qualification: "Master's in Psychology & PGDMH",
    experience: "7+ Years Experience",
    summary:
      "I believe that every person deserves a safe space to be heard, understood, and accepted without judgment. My approach focuses on helping individuals understand their thoughts, emotions, and behavioural patterns, while developing healthier ways to cope with challenges and navigate life's transitions.",
    specialties: [
      "Anxiety",
      "Stress",
      "Relationships",
      "Self-esteem",
      "Emotional Wellbeing",
      "Life Transitions",
      "Self-discovery",
      "Coping & Resilience",
      "Trauma",
    ],
    phone: "+91 8985002211",
    email: "prudhvi.v@vishnu.edu.in",
    languages: "Telugu & English",
    alt: "Ram Prudhvi Teja — Senior Wellness Counsellor",
  },
  {
    imgUrl: "/team/counsellor-2.jpg",
    name: "Devika Babu",
    role: "Wellness Counsellor",
    institution: "Vishnu Women's University",
    qualification: "MSc Psychology (Clinical), BSc Psychology, PGDSC",
    experience: "4 Years Experience",
    summary:
      "Devika Babu is a counselling psychologist with over 3.5 years of experience in clinics, rehabilitation and educational settings, working on stress, anxiety, emotional well-being, relationship issues, academic pressure, and psychometric assessments.",
    specialties: [
      "Stress Management & Emotional Well-being",
      "Grief, Loss & Trauma",
      "Relationship Difficulties",
      "Career & Life Adjustments",
      "Crisis Intervention",
    ],
    phone: "9100972237",
    email: "psychologist@svecw.edu.in",
    languages: "English, Malayalam, Hindi, Tamil",
    alt: "Devika Babu — Wellness Counsellor",
  },
  {
    imgUrl: "/team/counsellor-3.jpg",
    name: "Angel Mariam Benny",
    role: "Wellness Counsellor",
    institution: "Vishnu Dental College",
    qualification: "Master's in Clinical Psychology",
    experience: "4+ Years Experience",
    summary:
      "I believe in making space for the things that need to be heard, but often go unheard. My approach focuses on creating a safe, compassionate, and non-judgmental space where individuals can slow down and navigate the experiences that shape their emotional wellbeing.",
    specialties: [
      "Anxiety",
      "Stress",
      "Interpersonal Issues",
      "Self-esteem",
      "Emotional Wellbeing",
      "Life Transitions",
      "Self-discovery",
      "Coping & Resilience",
    ],
    phone: "7075214208",
    email: "AngelBenny99@gmail.com",
    alt: "Angel Mariam Benny — Wellness Counsellor",
  },
  {
    imgUrl: "/team/counsellor-4.jpg",
    name: "Akshitha Selvaraj",
    role: "Wellness Counsellor",
    institution: "Shri Vishnu College of Pharmacy",
    qualification: "MSc Psychology (Health and Wellbeing)",
    experience: "1 Year Experience",
    summary:
      "I believe in creating a safe, non-judgmental, and confidential space where students feel heard, understood, and supported. My approach is empathetic and collaborative, helping individuals build resilience, develop healthy coping strategies, and improve emotional well-being.",
    specialties: [
      "Stress & Anxiety",
      "Interpersonal & Relationship Issues",
      "Negative Thinking",
      "Coping & Resilience",
      "Personal Growth",
      "Time Management",
      "Overall Wellbeing",
    ],
    phone: "7842981717",
    email: "akshitha.s@svcp.edu.in",
    languages: "Telugu, English, Tamil & Hindi",
    alt: "Akshitha Selvaraj — Wellness Counsellor",
  },
  {
    imgUrl: "/team/counsellor-5.jpg",
    name: "Gadi Navya Sri",
    role: "Wellness Counsellor",
    institution: "B.V. Raju College",
    qualification: "M.A. Psychology",
    experience: "3 Years Experience",
    summary:
      "I see counseling as a way to better understand ourselves, our emotions, and the challenges we face. My work focuses on helping individuals navigate academic and personal pressures, understand emotional patterns, build confidence, and develop practical ways to cope.",
    specialties: [
      "Relationship & Family Concerns",
      "Academic Stress & Pressure",
      "Time Management & Procrastination",
      "Emotional Struggles & Self-Doubt",
      "Adjustment & Life Transitions",
      "Crisis Situations & Support",
      "Confidence Building",
    ],
    phone: "+91 8500567859",
    email: "navyasri.psy@gmail.com",
    languages: "Telugu & English",
    alt: "Gadi Navya Sri — Wellness Counsellor",
  },
  {
    imgUrl: "/team/counsellor-6.jpg",
    name: "Bantu Anumitha",
    role: "Wellness Counsellor",
    institution: "Smt. B. Seetha Polytechnic College",
    qualification: "MSc. Clinical Psychology",
    experience: "1 Year Experience",
    summary:
      "I believe every individual deserves to be heard without judgement. My role is not to tell you who to become, but to help you discover your strengths, build healthier coping skills through empathy, confidentiality and building resilience.",
    specialties: [
      "Stress",
      "Anxiety",
      "Relationships",
      "Emotional Wellbeing",
      "Anger Management",
    ],
    phone: "9390268994",
    email: "anumitab2019@gmail.com",
    languages: "English, Hindi, Telugu",
    alt: "Bantu Anumitha — Wellness Counsellor",
  },
  {
    imgUrl: "/team/counsellor-7.jpg",
    name: "Sahithi Challa",
    role: "Wellness Counsellor • Forensic Psychologist",
    institution: "Vishnu School",
    qualification: "Master's in Forensic Psychology & Trained Body Language Analyst",
    experience: "1+ Years Experience",
    summary:
      "I believe in creating a safe, empathetic, and non-judgmental space where individuals feel heard, understood, and supported. My approach focuses on helping individuals develop greater self-awareness, understand their thoughts and emotions, build healthy coping strategies, and navigate personal, academic, and interpersonal challenges.",
    specialties: [
      "Emotional Wellbeing",
      "Anxiety",
      "Stress Management",
      "Academic Stress",
      "Self-esteem & Confidence",
      "Interpersonal Concerns",
      "Coping & Resilience",
      "Self-awareness",
      "Life Transitions",
      "Crisis Support",
    ],
    phone: "6301187622",
    email: "sahithichalla.2001@gmail.com",
    languages: "Telugu, English, Hindi, Kannada",
    alt: "Sahithi Challa — Wellness Counsellor & Forensic Psychologist",
  },
];

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
    <div className="landing-page">
      <header className="landing-header">
        <Link to="/" className="landing-brand">
          <img src="/favicon.png" alt="Vishnu Wellness Center logo" className="landing-brand__logo" />
          <span className="landing-brand__name">Vishnu Wellness Center</span>
        </Link>

        <nav className="landing-nav">
          <div className="landing-nav__pill">
            <a href="#about" className="landing-nav__item">
              <svg className="landing-nav__icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>About</span>
            </a>
            <a href="#team" className="landing-nav__item">
              <svg className="landing-nav__icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span>Our Team</span>
            </a>
            <a href="#features" className="landing-nav__item">
              <svg className="landing-nav__icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              <span>Features</span>
            </a>
            <a href="#resources" className="landing-nav__item">
              <svg className="landing-nav__icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <span>Resources</span>
            </a>
            <a href="#faq" className="landing-nav__item">
              <svg className="landing-nav__icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>FAQ</span>
            </a>
          </div>
        </nav>

        <div className="landing-header__actions">
          {currentUser ? (
            <Link to={dashboardPath} className="btn-primary">
              Dashboard &rarr;
            </Link>
          ) : (
            <Link to="/login" className="btn-subtle">
              Sign In
            </Link>
          )}
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="landing-hero">
          <div className="landing-hero__content">
            <h1 className="landing-headline">
              Elevate Your Mind, Body &amp; Soul. <span className="landing-headline__accent">Redefined.</span>
            </h1>
            <p className="landing-subtitle">
              Book 1-on-1 sessions with certified psychologists, track your personal wellness journey, and
              receive dedicated counselling support—all in one seamless workspace.
            </p>
            <Link to={currentUser ? dashboardPath : "/signup"} className="btn-primary btn-hero-primary">
              Book Session &rarr;
            </Link>
          </div>
        </section>

        {/* Core Values */}
        <section className="landing-section">
          <h2 className="landing-section__title">Our Values</h2>
          <div className="landing-values">
            <div className="landing-values__item">
              <h3>Confidentiality</h3>
              <p>
                Everything you share stays strictly between you and your counsellor — private, secure, and never
                disclosed without your consent.
              </p>
            </div>
            <div className="landing-values__item">
              <h3>Empathy</h3>
              <p>
                Every session starts with genuinely listening — our counsellors meet you where you are, with warmth
                and understanding.
              </p>
            </div>
            <div className="landing-values__item">
              <h3>Non-judgemental</h3>
              <p>A safe space to share exactly as you are — no labels, no judgement, just support.</p>
            </div>
          </div>
        </section>

        {/* About / Guidelines */}
        <section className="landing-section" id="about">
          <span className="landing-eyebrow">About Vishnu Wellness Center</span>
          {/* Placeholder copy — replace with real content */}
          <h2 className="landing-section__title">A calm, judgment-free space to work through what's on your mind</h2>
          <p className="landing-section__body">
            Vishnu Wellness Center connects students and working professionals with licensed counsellors for
            private, one-on-one support. Every session follows a simple set of principles designed to keep the
            experience safe, consistent, and genuinely helpful.
          </p>
          <ul className="landing-checklist">
            <li>100% confidential — your sessions stay between you and your counsellor</li>
            <li>Matched with licensed, certified mental health professionals</li>
            <li>Flexible scheduling that works around your routine</li>
            <li>A judgment-free space, every session</li>
          </ul>

          <PerspectiveDeckCarousel items={ABOUT_CARDS} />
        </section>

        {/* Our Team — placeholder photos via fan carousel; swap imgUrl for real photos when ready */}
        <section className="landing-section" id="team">
          <span className="landing-eyebrow">Our Team</span>
          <h2 className="landing-section__title">The people behind Vishnu Wellness Center</h2>
          <p className="landing-section__body">
            Our counsellors are licensed, certified mental health professionals dedicated to providing compassionate,
            personalised support — hover the cards to meet the team.
          </p>

          <CardFanCarousel cards={TEAM_CARDS} />
        </section>

        {/* Features — placeholder highlights, replace with real specifics */}
        <section className="landing-section" id="features">
          <span className="landing-eyebrow">Why Vishnu Wellness Center</span>
          <h2 className="landing-section__title">Everything you need for your wellness journey</h2>

          <div className="landing-list">
            <div className="landing-list__item">
              <div className="landing-list__icon">
                <svg viewBox="0 0 24 24">
                  <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                </svg>
              </div>
              <div>
                <h3>1-on-1 Video &amp; Chat Sessions</h3>
                <p>Connect with your counsellor privately, on your schedule.</p>
              </div>
            </div>

            <div className="landing-list__item">
              <div className="landing-list__icon">
                <svg viewBox="0 0 24 24">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1.2 14.6l-3.6-3.6 1.4-1.4 2.2 2.2 5-5 1.4 1.4-6.4 6.4z" />
                </svg>
              </div>
              <div>
                <h3>Certified Psychologists</h3>
                <p>Every counsellor is vetted and certified before joining.</p>
              </div>
            </div>

            <div className="landing-list__item">
              <div className="landing-list__icon">
                <svg viewBox="0 0 24 24">
                  <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
                </svg>
              </div>
              <div>
                <h3>Flexible Scheduling</h3>
                <p>Book, reschedule, or follow up whenever it suits you.</p>
              </div>
            </div>

            <div className="landing-list__item">
              <div className="landing-list__icon">
                <svg viewBox="0 0 24 24">
                  <path d="M12 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm6-9h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zM8 6a4 4 0 0 1 8 0v2H8V6z" />
                </svg>
              </div>
              <div>
                <h3>Confidential by Design</h3>
                <p>Your sessions and details stay private, always.</p>
              </div>
            </div>

            <div className="landing-list__item">
              <div className="landing-list__icon">
                <svg viewBox="0 0 24 24">
                  <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z" />
                </svg>
              </div>
              <div>
                <h3>Progress You Can Track</h3>
                <p>Session history and follow-ups, all in one place.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Resources — generic placeholder labels, no invented real titles/authors */}
        <section className="landing-section" id="resources">
          <span className="landing-eyebrow">Resources We Follow</span>
          <h2 className="landing-section__title">Grounded in trusted guidelines and reading</h2>

          <div className="landing-list">
            <div className="landing-list__item">
              <div>
                <span className="landing-tag">Recommended Reading</span>
                <h3>Placeholder Book Title</h3>
                <p>A short placeholder description of what this resource covers.</p>
              </div>
            </div>

            <div className="landing-list__item">
              <div>
                <span className="landing-tag">Clinical Guideline</span>
                <h3>Placeholder Guideline Name</h3>
                <p>The framework our counsellors follow during sessions.</p>
              </div>
            </div>

            <div className="landing-list__item">
              <div>
                <span className="landing-tag">Self-Help Resource</span>
                <h3>Placeholder Resource Name</h3>
                <p>A tool or worksheet used to support ongoing care.</p>
              </div>
            </div>

            <div className="landing-list__item">
              <div>
                <span className="landing-tag">Research &amp; Reference</span>
                <h3>Placeholder Reference Title</h3>
                <p>Background reading our approach is grounded in.</p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="landing-section" id="faq">
          <div className="landing-faq-layout">
            {/* Left Column: Heading & Contact Info */}
            <div className="landing-faq-sidebar">
              <h2 className="landing-faq-title">FAQs</h2>
              <p className="landing-faq-subtitle">
                Everything you need to know about Vishnu Wellness Center
              </p>
              <p className="landing-faq-contact">
                Can&apos;t find what you&apos;re looking for? Reach out to our{" "}
                <a href="#footer" className="landing-faq-contact__link">
                  support team
                </a>{" "}
                for assistance.
              </p>
            </div>

            {/* Right Column: Interactive Accordion List */}
            <div className="faq-list" onMouseLeave={() => setOpenFaqIndex(null)}>
              {FAQS.map((faq, index) => {
                const isOpen = openFaqIndex === index;
                return (
                  <div
                    key={faq.question}
                    className={`faq-item ${isOpen ? "faq-item--open" : ""}`}
                    onMouseEnter={() => setOpenFaqIndex(index)}
                  >
                    <button
                      type="button"
                      className="faq-item__question"
                      aria-expanded={isOpen}
                      onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    >
                      <span className="faq-item__question-text">{faq.question}</span>
                      <svg
                        className={`faq-item__chevron ${isOpen ? "faq-item__chevron--open" : ""}`}
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                    <div className={`faq-item__answer-wrapper ${isOpen ? "faq-item__answer-wrapper--open" : ""}`}>
                      <div className="faq-item__answer-content">
                        <p className="faq-item__answer">{faq.answer}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Terms and Policies */}
        <section className="landing-section" id="terms">
          <span className="landing-eyebrow">Terms and Policies</span>
          <h2 className="landing-section__title">Please review our terms before you begin</h2>

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
              <strong>Duration of Sessions:</strong> Counselling sessions typically last 45 minutes unless otherwise
              arranged with your counsellor.
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
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer__accent-bar" />

        {/* Placeholder copy — replace with a real crisis/helpline message */}
        <div className="landing-footer__crisis">
          <p>
            If you're experiencing an emergency and need immediate help, call a crisis helpline or go to the
            nearest hospital.
          </p>
        </div>

        <div className="landing-footer__main">
          <div className="landing-footer__brand">
            <span className="landing-footer__brand-line" />
            <img src="/favicon.png" alt="Vishnu Wellness Center logo" className="landing-footer__brand-logo" />
            <span className="landing-footer__brand-name">Vishnu Wellness Center</span>
            <span className="landing-footer__brand-line" />
          </div>

          <div className="landing-footer__columns">
            <div className="landing-footer__col landing-footer__col--signup">
              <h4>I'm excited. Tell me more.</h4>
              <form
                className="landing-footer__signup"
                onSubmit={(e) => {
                  e.preventDefault();
                }}
              >
                <input type="email" placeholder="Enter your email" required />
                <button type="submit">Submit</button>
              </form>
              <p className="landing-footer__question">
                Have a question?
                <br />
                Email us anytime: <a href="mailto:care@vishnuwellness.app">care@vishnuwellness.app</a>
              </p>
              <div className="landing-footer__socials">
                <a
                  href="https://www.instagram.com/vishnu_wellness_centre"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-icon-btn"
                  aria-label="Instagram"
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </a>
                <a
                  href="https://youtube.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-icon-btn"
                  aria-label="YouTube"
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Placeholder columns — links and copy to be finalised later */}
            <div className="landing-footer__col">
              <h4>Popular</h4>
              <ul>
                <li><a href="#about">About</a></li>
                <li><a href="#features">Features</a></li>
                <li><a href="#resources">Resources</a></li>
                <li><a href="#faq">FAQ</a></li>
              </ul>
            </div>

            <div className="landing-footer__col">
              <h4>Learn</h4>
              <ul>
                <li><a href="#team">Our Team</a></li>
                <li><a href="#">How It Works</a></li>
                <li><a href="#">Testimonials</a></li>
                <li><a href="#">Our Approach</a></li>
              </ul>
            </div>

            <div className="landing-footer__col">
              <h4>Connect</h4>
              <ul>
                <li><a href="#">WhatsApp</a></li>
                <li>
                  <a href="https://www.instagram.com/vishnu_wellness_centre" target="_blank" rel="noopener noreferrer">
                    Instagram
                  </a>
                </li>
                <li><a href="#">Facebook</a></li>
                <li>
                  <a href="https://youtube.com" target="_blank" rel="noopener noreferrer">
                    YouTube
                  </a>
                </li>
              </ul>
            </div>

            <div className="landing-footer__col">
              <h4>Careers</h4>
              <ul>
                <li><a href="#">For Counsellors</a></li>
                <li><a href="#">For Admins</a></li>
                <li><a href="#">Others</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="landing-footer__bottom">
          <span>&copy; 2026 Vishnu Wellness Center</span>
          <span>
            All Rights Reserved | <a href="#terms">Terms and Conditions</a> | <a href="#">Privacy Policy</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
