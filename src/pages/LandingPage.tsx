import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useSpring } from "framer-motion";
import { useAuth } from "../hooks/useAuth";
import { dashboardPathForRole } from "../utils/roleRedirect";
import { CardFanCarousel } from "../components/ui/CardFanCarousel";
import { PerspectiveDeckCarousel } from "../components/ui/PerspectiveDeckCarousel";
import { AnimatedHero } from "../components/ui/animated-hero";
import { MorphingPopover, MorphingPopoverTrigger, MorphingPopoverContent } from "../components/common/MorphingPopover";
import { ReferStudentForm } from "./ReferStudentForm";
import "./LandingPage.css";

const DOING_CARDS = [
  {
    id: 1,
    title: "My brain won't switch off.",
    desc: "Overthinking • Anxiety • Racing thoughts",
    image: "/find-help/find-help-1.jpg",
    theme: "pink",
    alt: "My brain won't switch off",
  },
  {
    id: 2,
    title: "Academics are getting to me.",
    desc: "Exam stress • Performance pressure • Procrastination",
    image: "/find-help/find-help-2.jpg",
    theme: "blue",
    alt: "Academics are getting to me",
  },
  {
    id: 3,
    title: "I'm running on empty.",
    desc: "Burnout • Sleep • Motivation • Digital overload",
    image: "/find-help/find-help-3.jpg",
    theme: "mint",
    alt: "I'm running on empty",
  },
  {
    id: 4,
    title: "It's complicated.",
    desc: "Relationships • Friendships • Family • Boundaries",
    image: "/find-help/find-help-4.jpg",
    theme: "peach",
    alt: "It's complicated",
  },
  {
    id: 5,
    title: "I'm figuring myself out.",
    desc: "Confidence • Self-esteem • Identity • Personal growth",
    image: "/find-help/find-help-5.jpg",
    theme: "lavender",
    alt: "I'm figuring myself out",
  },
  {
    id: 6,
    title: "I need someone to talk to.",
    desc: "A safe space to share and get support",
    image: "/find-help/find-help-6.jpg",
    theme: "yellow",
    alt: "I need someone to talk to",
  },
];

const VALUES_CARDS = [
  {
    id: 1,
    title: "Confidentiality",
    subtitle: "100% Private & Secure",
    description:
      "Everything you share stays strictly between you and your counsellor — private, secure, and never disclosed without your consent.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    accentColor: "#059669",
    bgGradient: "linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)",
    borderColor: "#86EFAC",
  },
  {
    id: 2,
    title: "Empathy",
    subtitle: "Warmth & Understanding",
    description:
      "Every session starts with genuinely listening — our counsellors meet you where you are, with warmth, compassion, and deep understanding.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.72-8.72 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
    accentColor: "#4F46E5",
    bgGradient: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
    borderColor: "#A5B4FC",
  },
  {
    id: 3,
    title: "Non-judgemental",
    subtitle: "Safe Space Always",
    description:
      "A safe space to share exactly as you are — no labels, no stigma, no judgement, just unconditional support.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EA580C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
    accentColor: "#EA580C",
    bgGradient: "linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)",
    borderColor: "#FDBA74",
  },
  {
    id: 4,
    title: "Student-Centric",
    subtitle: "Campus & Academic Life",
    description:
      "Tailored specifically to academic life, exam pressure, career adjustments, relationships, and personal growth for Vishnu students.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#DB2777" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c3 3 9 3 12 0v-5" />
      </svg>
    ),
    accentColor: "#DB2777",
    bgGradient: "linear-gradient(135deg, #FDF2F8 0%, #FCE7F3 100%)",
    borderColor: "#F472B6",
  },
  {
    id: 5,
    title: "Professional Excellence",
    subtitle: "Certified Support",
    description:
      "Guidance provided by qualified mental health professionals utilizing evidence-based psychological tools and coping strategies.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="7" />
        <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
      </svg>
    ),
    accentColor: "#0284C7",
    bgGradient: "linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 100%)",
    borderColor: "#7DD3FC",
  },
];

const TEAM_CARDS = [
  {
    imgUrl: "/team/counsellor-1.jpg",
    name: "Ram Prudhvi Teja",
    role: "Senior Wellness Counsellor • Incharge",
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
    languages: "English, Malayalam, Hindi, Tamil, Arabic & Telugu",
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
    question: "What is counselling?",
    answer:
      "Counselling is a confidential and supportive conversation with a trained wellness counsellor. It gives you a safe space to understand your thoughts, emotions, behaviors, and challenges and to develop practical ways of coping and moving forward.\n\nYou don't need to have a serious problem to seek counselling. You can reach out whenever you feel overwhelmed, confused, or stressed, or simply want someone to talk to.",
  },
  {
    question: "Is counselling confidential?",
    answer:
      "Yes. Your privacy is respected. Information shared during counselling is handled professionally and is not routinely shared with friends, faculty, or other students.\n\nHowever, confidentiality has important limits in situations involving serious and immediate risk of harm to yourself or someone else, or where disclosure is otherwise required by applicable professional or legal requirements. Your counsellor will explain these limits when appropriate.",
  },
  {
    question: "Do I need to have a mental health problem to meet a counsellor?",
    answer:
      "Not at all. You can approach the Wellness Centre for everyday concerns such as:\n• Academic pressure & Exam stress\n• Overthinking & Relationship difficulties\n• Homesickness & Sleep problems\n• Low confidence & Family concerns\n• Anger, Loneliness, or Difficulty making decisions\n• Personal growth\n\nYou don't have to wait until things become serious to ask for support.",
  },
  {
    question: "How long does a counselling session last?",
    answer:
      "A counselling session generally takes around 45–60 minutes, depending on the nature of the session and the Wellness Centre's scheduling system. The exact duration may vary.",
  },
  {
    question: "Do I need an appointment?",
    answer:
      "Students can book a counselling appointment through the Vishnu Wellness Centre platform. If walk-in support is available at your institution, you may also approach the Wellness Centre directly.\n\nFor urgent concerns, follow the emergency support pathway rather than waiting for a routine appointment.",
  },
  {
    question: "Is counselling free for Vishnu students?",
    answer:
      "Counselling support provided through the Vishnu Wellness Centre is intended as a student wellness support service within the institution. Students should check the current Wellness Centre information or appointment system for details regarding any specialised external services or referrals that may involve additional costs.",
  },
  {
    question: "Can I approach the Wellness Centre for someone else?",
    answer:
      "Yes. If you are worried about a friend, roommate, or classmate, you can approach the Wellness Centre and explain your concern. You don't need to diagnose your friend — simply tell us what you have noticed and why you are concerned. The counsellor can guide you on how to approach and support the student appropriately.",
  },
  {
    question: "What if my friend is talking about suicide or self-harm?",
    answer:
      "Take it seriously and don't leave them to manage the situation alone. Stay with the person when possible, encourage them to seek immediate professional help, and contact the appropriate campus emergency/wellness support or emergency services when there is immediate danger.\n\nYou do not need to be a psychologist to help someone in crisis. If there is an immediate risk of harm, seek urgent in-person emergency assistance rather than waiting for a routine counselling appointment.",
  },
  {
    question: "What is the difference between a counsellor, psychologist, and psychiatrist?",
    answer:
      "• A psychologist is a trained mental health professional who may provide psychological assessment, counselling, and psychotherapy depending on their qualifications and scope of practice.\n• A counsellor provides structured psychological support and counselling within their professional training and scope.\n• A psychiatrist is a medical doctor specializing in mental health who can assess psychiatric conditions and prescribe medication when clinically appropriate.\n\nSometimes different professionals work together as part of a person's care.",
  },
];

const sectionReveal = {
  initial: { opacity: 0, y: 35 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
};

export function LandingPage() {
  const { currentUser, role } = useAuth();
  const dashboardPath = dashboardPathForRole(role);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeDoingIndex, setActiveDoingIndex] = useState(0);
  // Hover flips the card on desktop; touch screens have no hover, so a tap
  // toggles the same flip here instead.
  const [flippedDoingIds, setFlippedDoingIds] = useState<Set<number>>(new Set());
  const doingCarouselRef = useRef<HTMLDivElement>(null);

  function toggleDoingFlip(id: number) {
    setFlippedDoingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const scrollToDoingCard = useCallback((index: number) => {
    if (!doingCarouselRef.current) return;
    const cards = doingCarouselRef.current.querySelectorAll<HTMLElement>(".landing-doing-card");
    const targetCard = cards[index];
    if (targetCard) {
      targetCard.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
      setActiveDoingIndex(index);
    }
  }, []);

  const handleDoingScroll = useCallback(() => {
    if (!doingCarouselRef.current) return;
    const container = doingCarouselRef.current;
    const cards = container.querySelectorAll<HTMLElement>(".landing-doing-card");
    if (!cards.length) return;

    const containerCenter = container.scrollLeft + container.clientWidth / 2;
    let closestIndex = 0;
    let minDistance = Infinity;

    cards.forEach((card, idx) => {
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const distance = Math.abs(containerCenter - cardCenter);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = idx;
      }
    });

    setActiveDoingIndex(closestIndex);
  }, []);

  const handleDoingPrev = () => {
    const prev = Math.max(0, activeDoingIndex - 1);
    scrollToDoingCard(prev);
  };

  const handleDoingNext = () => {
    const next = Math.min(DOING_CARDS.length - 1, activeDoingIndex + 1);
    scrollToDoingCard(next);
  };

  const { scrollYProgress, scrollY } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  useEffect(() => {
    return scrollY.on("change", (latest) => {
      setIsScrolled(latest > 20);
    });
  }, [scrollY]);

  return (
    <div className="landing-page">
      {/* Top Reading Progress Bar */}
      <motion.div className="landing-scroll-progress" style={{ scaleX }} />

      <motion.header
        className={`landing-header ${isScrolled ? "landing-header--scrolled" : ""}`}
        initial={{ y: -25, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <Link to="/" className="landing-brand">
          <img src="/favicon.png" alt="Vishnu Wellness Center logo" className="landing-brand__logo" />
          <span className="landing-brand__name">
            Vishnu Wellness <span className="landing-brand__name-break">Center</span>
          </span>
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
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.72-8.72 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <span>Find Help</span>
            </a>
            <a href="#faq" className="landing-nav__item">
              <svg className="landing-nav__icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>FAQ</span>
            </a>
            <a href="#terms" className="landing-nav__item">
              <svg className="landing-nav__icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span>Terms &amp; Policies</span>
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
      </motion.header>

      <main>
        {/* Animated Hero Section */}
        <AnimatedHero currentUser={currentUser} dashboardPath={dashboardPath} />

        {/* About Section — Split 2-Column Design */}
        <motion.section {...sectionReveal} className="landing-section landing-about-section" id="about">
          <div className="landing-about-container">
            {/* Left Column: Content */}
            <div className="landing-about-content">
              <h2 className="landing-about-title">
                A calm, judgment-free space to work through what&apos;s on your{" "}
                <span className="landing-about-title__accent">
                  mind.
                  <svg className="landing-about-title__stroke" viewBox="0 0 120 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 8C35 3.5 85 9 117 4" stroke="#0D9488" strokeWidth="3.5" strokeLinecap="round" />
                  </svg>
                </span>
              </h2>

              <p className="landing-about-body">
                Vishnu Wellness Centre is a student-focused space where you can talk, reflect and find support for
                life&apos;s challenges — academic, personal or emotional. Our counsellors are here to listen, guide and help
                you build practical skills for a healthier, happier you.
              </p>

              <div className="landing-about-features">
                <a href="#values" className="landing-about-feature">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0D9488" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span>Confidential</span>
                </a>
                <a href="#values" className="landing-about-feature">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0D9488" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <span>Student Friendly</span>
                </a>
                <a href="#values" className="landing-about-feature">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0D9488" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.72-8.72 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                  <span>Professional Support</span>
                </a>
                <a href="#values" className="landing-about-feature">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0D9488" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                  <span>No Judgement</span>
                </a>
              </div>
            </div>

            {/* Right Column: Photo with Doodle Stickers */}
            <div className="landing-about-media">
              <div className="landing-about-image-wrapper">
                <img
                  src="/about-campus-students.jpg"
                  alt="Vishnu Wellness Centre campus students talking together"
                  className="landing-about-image"
                />
              </div>

              {/* Doodle Sticker 1 (Top Left) */}
              <div className="landing-about-doodle landing-about-doodle--yellow">
                <div className="landing-about-doodle__card">
                  <span className="landing-about-doodle__line1">You</span>
                  <span className="landing-about-doodle__line2">Matter</span>
                  <span className="landing-about-doodle__line3">Here</span>
                </div>
              </div>

              {/* Doodle Sticker 2 (Top Right) */}
              <div className="landing-about-doodle landing-about-doodle--mint">
                <div className="landing-about-doodle__bubble">
                  <span>TALK</span>
                  <span>REFLECT</span>
                  <span>GROW</span>
                  <svg className="landing-about-doodle__arrow" width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M6 8C10 8 16 10 16 18M16 18L11 14M16 18L20 14" stroke="#0D9488" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Core Values */}
        <motion.section {...sectionReveal} className="landing-section" id="values">
          <div className="landing-section-container">
            <h2 className="landing-section__title">Our Values</h2>
            <p className="landing-section__body">
              Every interaction at Vishnu Wellness Centre is grounded in empathy, complete privacy, and non-judgmental support.
            </p>

            <PerspectiveDeckCarousel items={VALUES_CARDS} />
          </div>
        </motion.section>

        {/* Our Team */}
        <motion.section {...sectionReveal} className="landing-section" id="team">
          <div className="landing-section-container">
            <h2 className="landing-section__title">The people behind Vishnu Wellness Center</h2>
            <p className="landing-section__body">
              Our counsellors are certified mental health professionals dedicated to providing compassionate,
              personalised support.
            </p>

            <CardFanCarousel cards={TEAM_CARDS} />
          </div>
        </motion.section>

        {/* Features / Why Vishnu Wellness Centre */}
        <motion.section {...sectionReveal} className="landing-section landing-journey-section" id="features">
          <div className="landing-journey-header">
            <h2 className="landing-section__title">Everything you need for your wellness journey</h2>
            <p className="landing-journey-subtitle">
              Professional support, practical tools and a safe space to help you navigate student life.
            </p>
          </div>

          <div className="landing-journey-grid">
            {/* Card 1: Confidential Counselling */}
            <div className="landing-journey-card landing-journey-card--teal">
              <div className="landing-journey-icon landing-journey-icon--teal">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  <circle cx="9" cy="10" r="1" fill="currentColor" />
                  <circle cx="12" cy="10" r="1" fill="currentColor" />
                  <circle cx="15" cy="10" r="1" fill="currentColor" />
                </svg>
              </div>
              <h3 className="landing-journey-card__title">Confidential Counselling</h3>
              <p className="landing-journey-card__desc">
                A safe space to talk about academic, personal, emotional or relationship concerns.
              </p>
            </div>

            {/* Card 2: Professional Support */}
            <div className="landing-journey-card landing-journey-card--indigo">
              <div className="landing-journey-icon landing-journey-icon--indigo">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h3 className="landing-journey-card__title">Professional Support</h3>
              <p className="landing-journey-card__desc">
                Guidance from trained counsellors with a compassionate, student-focused approach.
              </p>
            </div>

            {/* Card 3: Easy & Flexible Access */}
            <div className="landing-journey-card landing-journey-card--orange">
              <div className="landing-journey-icon landing-journey-icon--orange">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <h3 className="landing-journey-card__title">Easy &amp; Flexible Access</h3>
              <p className="landing-journey-card__desc">
                Book a session, reschedule or follow up at a time that works for you.
              </p>
            </div>

            {/* Card 4: Privacy Matters */}
            <div className="landing-journey-card landing-journey-card--rose">
              <div className="landing-journey-icon landing-journey-icon--rose">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <rect x="9" y="11" width="6" height="5" rx="1" />
                  <path d="M10 11V9a2 2 0 1 1 4 0v2" />
                </svg>
              </div>
              <h3 className="landing-journey-card__title">Privacy Matters</h3>
              <p className="landing-journey-card__desc">
                Your conversations and details are handled with care and confidentiality.
              </p>
            </div>

            {/* Card 5: Your Progress, Your Journey */}
            <div className="landing-journey-card landing-journey-card--mint">
              <div className="landing-journey-icon landing-journey-icon--mint">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a10 10 0 0 0-7.07 17.07L12 22l7.07-2.93A10 10 0 0 0 12 2z" />
                  <path d="M12 6v8" />
                  <path d="M8 10l4 4 4-4" />
                </svg>
              </div>
              <h3 className="landing-journey-card__title">Your Progress, Your Journey</h3>
              <p className="landing-journey-card__desc">
                Set goals, build coping skills and work towards a healthier, more balanced you.
              </p>
            </div>
          </div>
        </motion.section>

        {/* Find What You Need / How Are You Really Doing? */}
        <motion.section {...sectionReveal} className="landing-section landing-doing-section" id="resources">
          <div className="landing-doing-header">
            <h2 className="landing-section__title">
              How are you <span className="landing-accent-italic">really</span> doing?
            </h2>
            <p className="landing-doing-subtitle">
              Whatever you&apos;re going through, there&apos;s a place to start.
            </p>

            <div className="landing-doodle-note">
              <span className="landing-doodle-note__text">IT&apos;S OKAY TO NOT BE OKAY</span>
            </div>
          </div>

          <div
            ref={doingCarouselRef}
            onScroll={handleDoingScroll}
            className="landing-doing-grid"
          >
            {DOING_CARDS.map((card, idx) => {
              const isActive = activeDoingIndex === idx;
              const isFlipped = flippedDoingIds.has(card.id);
              return (
                <div
                  key={card.id}
                  className={`landing-doing-card landing-doing-card--${card.theme} ${isActive ? "landing-doing-card--active" : ""} ${isFlipped ? "landing-doing-card--flipped" : ""}`}
                  onClick={() => toggleDoingFlip(card.id)}
                  role="button"
                  tabIndex={0}
                  aria-label={isFlipped ? `${card.title} — showing related topics, tap to flip back` : `${card.title} — tap to see related topics`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleDoingFlip(card.id);
                    }
                  }}
                >
                  <div className="landing-doing-card__flipper">
                    <div className="landing-doing-card__face landing-doing-card__face--front">
                      <h3 className="landing-doing-card__title">{card.title}</h3>
                    </div>
                    <div className="landing-doing-card__face landing-doing-card__face--back">
                      <p className="landing-doing-card__desc">{card.desc}</p>
                    </div>
                  </div>
                  <Link
                    to={currentUser ? dashboardPath : "/login"}
                    className="landing-doing-card__arrow"
                    aria-label={`Get started: ${card.title}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </Link>
                </div>
              );
            })}
          </div>

          {/* Mobile-Only Carousel Navigation Controls */}
          <div className="landing-doing-carousel-controls" aria-label="Carousel navigation">
            <button
              type="button"
              className="landing-doing-nav-btn landing-doing-nav-btn--prev"
              onClick={handleDoingPrev}
              disabled={activeDoingIndex === 0}
              aria-label="Previous card"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <div className="landing-doing-dots">
              {DOING_CARDS.map((card, idx) => (
                <button
                  key={card.id}
                  type="button"
                  className={`landing-doing-dot landing-doing-dot--${card.theme} ${activeDoingIndex === idx ? "landing-doing-dot--active" : ""}`}
                  onClick={() => scrollToDoingCard(idx)}
                  aria-label={`Go to slide ${idx + 1}: ${card.title}`}
                />
              ))}
            </div>

            <button
              type="button"
              className="landing-doing-nav-btn landing-doing-nav-btn--next"
              onClick={handleDoingNext}
              disabled={activeDoingIndex === DOING_CARDS.length - 1}
              aria-label="Next card"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </motion.section>

        {/* FAQ */}
        <motion.section {...sectionReveal} className="landing-section" id="faq">
          <div className="landing-faq-layout">
            {/* Left Column: Heading & Contact Info */}
            <div className="landing-faq-sidebar">
              <h2 className="landing-faq-title">Still Have Questions?</h2>
              <p className="landing-faq-subtitle">
                We&apos;re here to help. Explore more frequently asked questions or speak with our Wellness Team.
              </p>
              <div className="landing-faq-actions">
                <Link to={currentUser ? dashboardPath : "/signup"} className="btn-primary landing-faq-btn">
                  Book a Session
                </Link>
                <p className="landing-faq-note">
                  You don&apos;t have to figure everything out alone. <a href="#team" className="landing-faq-note__link">Talk to a wellness counselor &rarr;</a>
                </p>
              </div>
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
        </motion.section>

        {/* Terms and Policies */}
        <motion.section {...sectionReveal} className="landing-section landing-terms-section" id="terms">
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
        </motion.section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer__accent-bar" />

        <div className="landing-footer__crisis">
          <p>
            Your well-being. Your space. Your journey. A safe, confidential and student-focused space to talk,
            understand what you're going through, and build practical skills for a healthier college life.
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
                Email us anytime: <a href="mailto:vishnuwellnesscentre@gmail.com">vishnuwellnesscentre@gmail.com</a>
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
                  href="https://wa.me/919100972237"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-icon-btn"
                  aria-label="WhatsApp"
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M12.004 2C6.477 2 2 6.477 2 12.004c0 1.996.587 3.86 1.6 5.425L2 22l4.676-1.566a9.94 9.94 0 0 0 5.328 1.537h.004c5.527 0 10.004-4.477 10.004-10.004C22.012 6.477 17.531 2 12.004 2zm0 18.17h-.003a8.14 8.14 0 0 1-4.153-1.136l-.298-.177-3.1 1.04 1.056-3.023-.194-.31a8.147 8.147 0 0 1-1.25-4.356c0-4.503 3.665-8.168 8.172-8.168 2.182 0 4.233.851 5.776 2.396a8.112 8.112 0 0 1 2.39 5.78c0 4.503-3.665 8.168-8.396 8.168zm4.48-6.118c-.245-.123-1.452-.717-1.677-.8-.225-.082-.389-.123-.553.123-.164.246-.635.8-.779.964-.144.164-.287.185-.533.062-.245-.123-1.036-.382-1.973-1.216-.729-.65-1.221-1.453-1.364-1.699-.144-.246-.015-.379.108-.501.11-.11.246-.287.369-.43.123-.144.164-.246.246-.41.082-.164.041-.308-.021-.431-.062-.123-.553-1.334-.758-1.827-.2-.48-.403-.414-.553-.422l-.472-.008a.91.91 0 0 0-.656.308c-.225.246-.86.84-.86 2.05 0 1.21.881 2.378 1.004 2.542.123.164 1.733 2.646 4.2 3.71.587.253 1.044.404 1.401.517.588.187 1.123.161 1.546.098.472-.07 1.452-.594 1.657-1.167.205-.574.205-1.066.144-1.168-.062-.103-.225-.164-.471-.287z" />
                  </svg>
                </a>
              </div>
            </div>

            <div className="landing-footer__col">
              <h4>Explore</h4>
              <ul>
                <li><a href="#about">About Us</a></li>
                <li><a href="#values">How It Works</a></li>
                <li>
                  <MorphingPopover>
                    <MorphingPopoverTrigger className="landing-footer__morph-trigger">
                      Wellness Programs
                    </MorphingPopoverTrigger>
                    <MorphingPopoverContent title="Wellness Programs" className="landing-parents-modal">
                      <div className="landing-parents-modal__body">
                        <p className="landing-parents-modal__lead">
                          <strong>Building a healthier, more connected campus.</strong>
                          <br />
                          Our wellness programs support students, faculty and the wider campus community
                          through awareness, prevention, emotional support, skill-building and meaningful
                          engagement. Explore the programs happening across Vishnu Educational Society and
                          find opportunities to learn, connect, participate and grow.
                        </p>

                        <section>
                          <h4>Core Wellness Programs</h4>
                          <p>The key programs conducted as part of the Vishnu Wellness Centre's annual wellness plan.</p>
                        </section>

                        <section>
                          <h4 className="landing-parents-modal__item-title">Orientation Program – 1st Year Students</h4>
                          <p className="landing-parents-modal__meta">For: First-year students · When: July–August · Format: Interactive orientation</p>
                          <p>
                            A student-friendly introduction to campus life, emotional well-being, available
                            support systems, healthy adjustment, relationships, academic expectations and
                            help-seeking.
                          </p>
                          <p>What students can expect:</p>
                          <ul>
                            <li>Understanding the transition to college life</li>
                            <li>Emotional adjustment and coping</li>
                            <li>Building healthy routines</li>
                            <li>Knowing when and where to seek support</li>
                            <li>Introduction to Vishnu Wellness Centre</li>
                          </ul>
                        </section>

                        <section>
                          <h4 className="landing-parents-modal__item-title">Faculty Training on Mental Health & Well-being</h4>
                          <p className="landing-parents-modal__meta">For: Faculty & academic staff · When: July–August · Format: Training / Workshop</p>
                          <p>
                            Interactive faculty development sessions designed to help educators recognise
                            emotional and behavioural concerns among students and respond appropriately.
                          </p>
                          <p>Focus areas:</p>
                          <ul>
                            <li>Understanding student well-being</li>
                            <li>Recognising early warning signs</li>
                            <li>Supportive communication</li>
                            <li>Appropriate referral</li>
                            <li>Building a supportive classroom environment</li>
                          </ul>
                        </section>

                        <section>
                          <h4 className="landing-parents-modal__item-title">Strong Minds, Healthy Cycles</h4>
                          <p className="landing-parents-modal__meta">For: Students · When: March, on occasion of International Women's Day · Format: Awareness & interactive session</p>
                          <p>
                            A wellness initiative focusing on menstrual health, emotional well-being, body
                            awareness, healthy coping, and creating a comfortable space for conversations
                            around menstrual experiences.
                          </p>
                        </section>

                        <section>
                          <h4 className="landing-parents-modal__item-title">World Mental Health Day</h4>
                          <p className="landing-parents-modal__meta">For: Girls · When: October · Format: Campus-wide campaign</p>
                          <p>
                            A special annual wellness campaign featuring awareness activities, interactive
                            experiences, student engagement and conversations around emotional well-being.
                          </p>
                        </section>

                        <section>
                          <h4 className="landing-parents-modal__item-title">Suicide Prevention Day</h4>
                          <p className="landing-parents-modal__meta">For: Entire campus community · When: September · Format: Awareness campaign</p>
                          <p>
                            A campus-wide initiative promoting suicide prevention, help-seeking, peer support
                            and compassionate conversations.
                          </p>
                          <p className="landing-parents-modal__quote">"Talk. Listen. Support. Be the Change."</p>
                        </section>

                        <section>
                          <h4 className="landing-parents-modal__item-title">Group Wellness Sessions</h4>
                          <p className="landing-parents-modal__meta">For: 1st, 2nd, 3rd & 4th Year Students · When: Throughout the academic year · Format: Group sessions</p>
                          <p>Interactive sessions designed around common student experiences and developmental needs.</p>
                          <p>Possible themes:</p>
                          <ul>
                            <li>Managing academic stress</li>
                            <li>Emotional regulation</li>
                            <li>Relationships & communication</li>
                            <li>Self-esteem</li>
                            <li>Overthinking</li>
                            <li>Digital well-being</li>
                            <li>Exam anxiety</li>
                            <li>Peer relationships</li>
                            <li>Coping skills</li>
                            <li>Personal growth</li>
                          </ul>
                        </section>

                        <section>
                          <h4 className="landing-parents-modal__item-title">Digital Detox Sessions</h4>
                          <p className="landing-parents-modal__meta">For: 1st & 2nd Year Students · When: Throughout the academic year · Format: Interactive wellness activity</p>
                          <p>
                            Sessions that encourage students to reflect on their relationship with technology
                            and develop healthier digital habits.
                          </p>
                          <p>Focus areas:</p>
                          <ul>
                            <li>Screen awareness</li>
                            <li>Social media habits</li>
                            <li>Attention & concentration</li>
                            <li>Digital boundaries</li>
                            <li>Offline connection</li>
                            <li>Mindful technology use</li>
                          </ul>
                          <p className="landing-parents-modal__quote">"Disconnect to Reconnect."</p>
                        </section>

                        <section>
                          <h4 className="landing-parents-modal__item-title">Psychology Club Activities</h4>
                          <p className="landing-parents-modal__meta">For: Interested students · Frequency: Monthly</p>
                          <p>
                            A student-led platform for exploring psychology through interactive activities,
                            discussions, experiments, games, awareness campaigns and creative learning.
                          </p>
                        </section>

                        <section>
                          <h4 className="landing-parents-modal__item-title">Movie Screening</h4>
                          <p className="landing-parents-modal__meta">For: Students · Frequency: Yearly / Periodic</p>
                          <p>
                            Curated movie screenings followed by guided discussions connecting cinema with
                            psychology, relationships, emotions, behaviour and well-being.
                          </p>
                        </section>

                        <section>
                          <h4 className="landing-parents-modal__item-title">Open Mic</h4>
                          <p className="landing-parents-modal__meta">For: Students · Frequency: Yearly / Periodic</p>
                          <p>A safe and supportive platform for students to express themselves through:</p>
                          <ul>
                            <li>Spoken Word</li>
                            <li>Music</li>
                            <li>Poetry</li>
                            <li>Storytelling</li>
                            <li>Performance</li>
                          </ul>
                          <p className="landing-parents-modal__quote">"Express. Explore. Connect."</p>
                        </section>

                        <section>
                          <h4 className="landing-parents-modal__item-title">Wellness Awareness Campaigns</h4>
                          <p className="landing-parents-modal__meta">For: Entire campus community · Frequency: Yearly / Periodic</p>
                          <p>
                            Interactive campaigns designed to make wellness conversations more accessible and
                            engaging for students.
                          </p>
                          <p>Campaigns may include:</p>
                          <ul>
                            <li>Awareness booths</li>
                            <li>Myth vs Fact</li>
                            <li>Interactive walls</li>
                            <li>Wellness challenges</li>
                            <li>Peer activities</li>
                            <li>Creative campaigns</li>
                            <li>Information resources</li>
                          </ul>
                        </section>
                      </div>
                    </MorphingPopoverContent>
                  </MorphingPopover>
                </li>
                <li><a href="#faq">FAQs</a></li>
                <li>
                  <a href="https://wa.me/919100972237" target="_blank" rel="noopener noreferrer">
                    Contact Us
                  </a>
                </li>
              </ul>
            </div>

            <div className="landing-footer__col">
              <h4>Support</h4>
              <ul>
                <li>
                  <Link to={currentUser ? dashboardPath : "/login"} className="landing-footer__crisis-link">
                    Crisis SOS
                  </Link>
                </li>
                <li><a href="#team">Our Wellness Counsellors</a></li>
                <li><a href="#resources">Student Resources</a></li>
                <li>
                  <MorphingPopover>
                    <MorphingPopoverTrigger className="landing-footer__morph-trigger">
                      Refer to Counsellor
                    </MorphingPopoverTrigger>
                    <MorphingPopoverContent title="Refer to Counsellor" className="landing-parents-modal">
                      <ReferStudentForm />
                    </MorphingPopoverContent>
                  </MorphingPopover>
                </li>
                <li>
                  <MorphingPopover>
                    <MorphingPopoverTrigger className="landing-footer__morph-trigger">
                      For Faculty
                    </MorphingPopoverTrigger>
                    <MorphingPopoverContent title="For Faculty & Staff" className="landing-parents-modal">
                      <div className="landing-parents-modal__body">
                        <p className="landing-parents-modal__lead">
                          <strong>Supporting Students Starts With Noticing.</strong>
                          <br />
                          Faculty members are often the first to notice when a student's behaviour, performance or
                          engagement begins to change.
                        </p>
                        <section>
                          <h4>How We Can Support You</h4>
                        </section>
                        <section>
                          <h4 className="landing-parents-modal__item-title">Notice</h4>
                          <p>Recognise changes in behaviour, mood, academic engagement and social interaction.</p>
                        </section>
                        <section>
                          <h4 className="landing-parents-modal__item-title">Approach</h4>
                          <p>Learn how to start a supportive conversation without judgement or pressure.</p>
                        </section>
                        <section>
                          <h4 className="landing-parents-modal__item-title">Listen</h4>
                          <p>Create a safe space for the student to express what they're experiencing.</p>
                        </section>
                        <section>
                          <h4 className="landing-parents-modal__item-title">Connect</h4>
                          <p>Know when and how to connect a student with counselling support.</p>
                        </section>
                        <section>
                          <h4 className="landing-parents-modal__item-title">Refer</h4>
                          <p>Use the appropriate referral pathway when additional support is needed.</p>
                        </section>
                        <p className="landing-parents-modal__closing">
                          <strong>You don't have to have all the answers.</strong>
                          <br />
                          <strong className="landing-parents-modal__quote">
                            "You just need to notice, listen and help connect the student to the right support."
                          </strong>
                        </p>
                      </div>
                    </MorphingPopoverContent>
                  </MorphingPopover>
                </li>
                <li>
                  <MorphingPopover>
                    <MorphingPopoverTrigger className="landing-footer__morph-trigger">
                      For Parents
                    </MorphingPopoverTrigger>
                    <MorphingPopoverContent title="For Parents & Guardians" className="landing-parents-modal">
                      <div className="landing-parents-modal__body">
                        <section>
                          <h4 className="landing-parents-modal__item-title">1. Understanding Student Well-being</h4>
                          <p>Help parents understand the emotional, academic and social challenges students may experience during college.</p>
                        </section>
                        <section>
                          <h4 className="landing-parents-modal__item-title">2. How Can I Support My Student?</h4>
                          <p>Practical guidance on listening, communicating and supporting students without creating additional pressure.</p>
                        </section>
                        <section>
                          <h4 className="landing-parents-modal__item-title">3. When Should I Be Concerned?</h4>
                          <p>Common changes in mood, behaviour, academics, sleep, attendance, social interaction and daily functioning that may indicate a student needs support.</p>
                        </section>
                        <section>
                          <h4 className="landing-parents-modal__item-title">4. Starting the Conversation</h4>
                          <p>Simple ways to ask:</p>
                          <ul>
                            <li>"How are you really doing?"</li>
                            <li>"Is there anything you've been finding difficult lately?"</li>
                            <li>"Would you like me to listen, or would you like help finding support?"</li>
                          </ul>
                        </section>
                        <section>
                          <h4 className="landing-parents-modal__item-title">5. When Professional Support May Help</h4>
                          <p>Explain when counselling or additional professional support may be useful.</p>
                        </section>
                        <section>
                          <h4 className="landing-parents-modal__item-title">6. Academic Stress & College Life</h4>
                          <p>Guidance around exam pressure, performance expectations, procrastination, adjustment and academic setbacks.</p>
                        </section>
                        <section>
                          <h4 className="landing-parents-modal__item-title">7. Digital Well-being & Lifestyle</h4>
                          <p>Sleep, screen time, social media, routines, physical activity and healthy habits.</p>
                        </section>
                        <section>
                          <h4 className="landing-parents-modal__item-title">8. Connecting With Vishnu Wellness Centre</h4>
                          <p>Explain how students can access counseling and how parents can encourage them to seek support.</p>
                        </section>
                        <section>
                          <h4 className="landing-parents-modal__item-title">9. Parent FAQs</h4>
                          <p>Questions about counselling, confidentiality, appointments, referrals and what parents can expect.</p>
                        </section>
                        <section>
                          <h4 className="landing-parents-modal__item-title">10. Urgent Support</h4>
                          <p>Clear guidance about what to do when there is an immediate safety concern or emergency.</p>
                        </section>
                        <p className="landing-parents-modal__closing">
                          <strong>Supporting Your Student Starts With Understanding.</strong><br />
                          Learn how to listen, communicate and connect your students with the right support when they need it.
                        </p>
                      </div>
                    </MorphingPopoverContent>
                  </MorphingPopover>
                </li>
              </ul>
            </div>

            <div className="landing-footer__col">
              <h4>Connect</h4>
              <ul>
                <li>
                  <a href="https://wa.me/919100972237" target="_blank" rel="noopener noreferrer">
                    WhatsApp
                  </a>
                </li>
                <li>
                  <a href="https://www.instagram.com/vishnu_wellness_centre" target="_blank" rel="noopener noreferrer">
                    Instagram
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="landing-footer__bottom">
          <div className="landing-footer__bottom-left">
            <span>&copy; 2018 Vishnu Wellness Center</span>
            <span className="landing-footer__bottom-sub">A wellness initiative of Sri Vishnu Educational Society</span>
          </div>
          <span>
            <a href="#">Privacy &amp; Confidentiality</a> | <a href="#terms">Terms of Use</a> | <a href="#">Accessibility</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
