import { Modal } from "../components/common/Modal";
import "./StudentResourcesModal.css";

interface StudentResource {
  id: string;
  title: string;
  subtitle: string;
  summary: string;
  thingsToTry: string[];
  smallStep: string;
  support: string;
}

const resources: StudentResource[] = [
  {
    id: "brain-wont-switch-off",
    title: "My brain won’t switch off",
    subtitle: "Overthinking, worry and racing thoughts",
    summary: "When your mind keeps replaying conversations or predicting problems, it can be hard to rest. You do not need to force every thought away. Start by noticing what your mind is doing and choosing where to place your attention next.",
    thingsToTry: [
      "Name it: “I’m noticing that I’m worrying about…” Observe the thought rather than treating it as a fact.",
      "Ground yourself: notice five things you can see, four you can feel and three you can hear.",
      "Write the worry down and choose a 10–15 minute time later to consider practical next steps.",
      "Ask: “Is there one useful action I can take now?” If yes, make it small. If not, return gently to the task in front of you.",
    ],
    smallStep: "Write one worry, one fact you know and one small action within your control.",
    support: "Consider counselling if worry is frequent, difficult to manage, disrupts sleep or concentration, or causes you to avoid important activities.",
  },
  {
    id: "academics",
    title: "Academics are getting to me",
    subtitle: "Exam stress, performance pressure and procrastination",
    summary: "Academic pressure can make even a manageable task feel huge. Stress does not mean you are incapable; it may mean you need a clearer plan, a realistic workload or support.",
    thingsToTry: [
      "Shrink the task: replace “study the whole unit” with “read two pages and write three key points.”",
      "Try a focused block: work for 20–25 minutes, then take a short break. Adjust to suit the task.",
      "List deadlines and next actions. Start with what is urgent and important.",
      "Replace “I must get everything perfect” with “I can prepare steadily and do the best I can with the time available.”",
      "Include meals, sleep and breaks in your study plan.",
    ],
    smallStep: "Choose one task, define a 15-minute first step and begin before waiting for motivation.",
    support: "Seek support if stress affects attendance, sleep, eating, concentration or daily functioning, or if fear of failure feels unmanageable.",
  },
  {
    id: "running-on-empty",
    title: "I’m running on empty",
    subtitle: "Exhaustion, sleep and feeling overloaded",
    summary: "Feeling drained can follow sustained demands, poor sleep, illness or emotional strain. You do not have to earn rest by finishing everything.",
    thingsToTry: [
      "Check the basics: have you eaten, had water, moved a little and had a chance to rest?",
      "Take a recovery break: stretch gently, sit somewhere quieter or take a short walk if comfortable.",
      "Create a simple wind-down routine and aim for a reasonably consistent sleep schedule when possible.",
      "Identify one task that can be delayed, simplified, shared or discussed with someone.",
      "If exhaustion persists, consider emotional and physical causes and seek appropriate advice.",
    ],
    smallStep: "Choose one restorative action that takes ten minutes and put it in your day.",
    support: "Seek support if exhaustion persists, daily functioning is affected or sleep problems continue. Physical symptoms may also need medical assessment.",
  },
  {
    id: "its-complicated",
    title: "It’s complicated",
    subtitle: "Relationships, communication and boundaries",
    summary: "Friendships, family expectations, romantic relationships and group dynamics can be confusing. Healthy relationships allow respect, safety, honesty and room for boundaries.",
    thingsToTry: [
      "Pause before replying if emotions are high; return when you can speak more clearly.",
      "Try an “I” statement: “I feel ___ when ___ happens. I would prefer ___.”",
      "Clarify what you can agree to, what you cannot and what you will do if a boundary is not respected.",
      "Separate what you observed from what you are assuming the other person meant.",
      "Talk to someone trustworthy who can listen without pressuring you.",
    ],
    smallStep: "Write one sentence that expresses your need respectfully and clearly.",
    support: "Seek help if a relationship involves threats, coercion, stalking, harassment or violence, or makes you feel unsafe.",
  },
  {
    id: "dont-feel-like-myself",
    title: "I don’t feel like myself",
    subtitle: "Low mood, loneliness, motivation and confidence",
    summary: "Everyone has difficult days, but feeling unlike yourself can be unsettling. You deserve support even if you cannot explain exactly what is wrong.",
    thingsToTry: [
      "Make the next step small: wash your face, eat something, open a window or step outside briefly if you can.",
      "Reconnect gently: message someone safe or join a low-pressure activity.",
      "Ask what you would say to a friend in the same situation, then offer yourself similar kindness.",
      "Notice what helps, such as sleep, social connection, movement and meaningful activities.",
      "Choose one small action connected to learning, creativity, relationships or a value that matters to you.",
    ],
    smallStep: "Choose one manageable activity that gives your day a little structure.",
    support: "Consider counselling if low mood, loss of interest or loneliness persists, worsens or affects daily life. If you feel unsafe or think about harming yourself, seek immediate support.",
  },
  {
    id: "understand-myself",
    title: "I want to understand myself",
    subtitle: "Emotions, self-awareness and personal growth",
    summary: "Self-awareness is not about judging every feeling. It is about noticing what you experience, understanding possible needs and choosing a response that fits your values.",
    thingsToTry: [
      "Pause and label: “I’m feeling ___, and I notice it in my body as ___.”",
      "Ask what the emotion may signal: a need for rest, safety, connection, fairness, space or help.",
      "Journal briefly: What happened? What did I feel? What did I need? What could I try next time?",
      "Identify one difficulty you handled, one strength you used and one thing you learned.",
      "Allow mixed feelings: you can feel nervous and still take a meaningful step.",
    ],
    smallStep: "Complete: “Right now I feel ___; one thing I may need is ___.”",
    support: "A counsellor can help if emotions feel confusing, intense or difficult to manage alone.",
  },
  {
    id: "quick-reset",
    title: "I need a quick reset",
    subtitle: "Short grounding and calming exercises",
    summary: "A quick reset may help you pause and reorient when tense or scattered. Choose an exercise that feels comfortable; stop if it makes you feel worse.",
    thingsToTry: [
      "Breathe gently and comfortably; allow the out-breath to be a little longer if that feels okay. Do not force deep breaths.",
      "Notice the support beneath your feet and name three things you can see.",
      "Soften your jaw, lower your shoulders and relax your hands.",
      "Look around and identify where you are, what time of day it is and one thing you will do next.",
      "Take a micro-break: stand, stretch gently or move away from the screen for a minute.",
    ],
    smallStep: "Put both feet on the floor, look around the room and choose your next small action.",
    support: "These are optional self-help tools, not treatment. Stop if an exercise increases distress and choose another approach or contact a professional.",
  },
  {
    id: "worried-about-someone",
    title: "I’m worried about someone",
    subtitle: "How to support a friend or classmate",
    summary: "You do not need all the answers to support someone. Listening calmly and helping them connect with appropriate support can matter.",
    thingsToTry: [
      "Choose a private, appropriate moment and ask: “You seem different lately. How have things been for you?”",
      "Listen without rushing to fix things. You can say, “I’m glad you told me.”",
      "Avoid minimising their experience or promising secrecy about a dangerous situation.",
      "Offer to help them contact a trusted adult, Wellness Counsellor or appropriate service.",
      "If they may be in immediate danger, stay with them if safe and seek urgent help.",
    ],
    smallStep: "Check in, listen and ask what kind of support would be helpful.",
    support: "If someone talks about suicide, self-harm or immediate danger, take it seriously. Do not manage the situation alone or rely on a website form; seek urgent in-person help.",
  },
  {
    id: "talk-to-someone",
    title: "I need someone to talk to",
    subtitle: "What counselling is and how to access support",
    summary: "Counselling offers a confidential space to talk through concerns, understand patterns, explore options and develop coping strategies. You do not need to wait until things feel unbearable.",
    thingsToTry: [
      "Begin with what has been hardest lately; you do not need a perfect explanation.",
      "Ask about the counselling process, confidentiality and its limits before sharing sensitive information.",
      "Be honest about how you hope things will change and what support feels comfortable.",
      "If unsure whether counselling is right for you, ask the Wellness Centre about available options.",
      "A counsellor may suggest follow-up sessions or another service when appropriate.",
    ],
    smallStep: "Use the web application’s approved booking/contact option to request support.",
    support: "Counselling appointments are not an emergency service. If there is immediate danger, contact local emergency services or go to the nearest hospital.",
  },
  {
    id: "better-habits",
    title: "I want to build better habits",
    subtitle: "Sleep, routines, focus and digital balance",
    summary: "Small, repeatable actions are often easier to maintain than a complete lifestyle overhaul. Choose one habit that fits your current routine.",
    thingsToTry: [
      "Attach a new habit to an existing cue: after breakfast, review your top priority.",
      "Make it easy to start: keep your book open or study materials ready.",
      "Silence non-essential notifications during one focused block.",
      "Aim for a consistent sleep and wake time when possible and make the evening calmer.",
      "If a habit slips, ask what got in the way and make the next attempt smaller.",
    ],
    smallStep: "Choose one habit so small you could repeat it even on a difficult day.",
    support: "If sleep, concentration or daily routines remain seriously disrupted, consider professional support.",
  },
];

const faqs = [
  {
    question: "Do I need to be in crisis to contact the Wellness Centre?",
    answer: "No. You can ask for support with everyday stress, academic pressure, relationships, adjustment, motivation or personal growth.",
  },
  {
    question: "Will my counselling information be confidential?",
    answer: "Counselling information is handled according to professional practice and institutional procedures. Confidentiality can have limits where disclosure is required by law or necessary to respond to serious safety concerns. Ask your counsellor about these limits.",
  },
  {
    question: "Are these resources a diagnosis or a substitute for counselling?",
    answer: "No. They provide general education and self-help ideas. They cannot diagnose a mental health condition or replace an individual assessment.",
  },
  {
    question: "What if an exercise does not help?",
    answer: "Different approaches work for different people. Stop an exercise that increases distress, try another option or speak with a counsellor.",
  },
  {
    question: "Can I refer a friend?",
    answer: "Encourage your friend to contact the Wellness Centre. Use the approved referral process where available, share only relevant information and respect their privacy. If immediate safety is at risk, seek urgent help.",
  },
  {
    question: "What if I need urgent help?",
    answer: "Do not wait for an online form or routine appointment if you or someone else is in immediate danger. Contact local emergency services or go to the nearest hospital.",
  },
];

interface StudentResourcesModalProps {
  onClose: () => void;
}

export function StudentResourcesModal({ onClose }: StudentResourcesModalProps) {
  function jumpToResource(id: string) {
    document.getElementById(`student-resource-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <Modal title="Student Resources" onClose={onClose} className="student-resources-modal">
      <div className="student-resources">
        <header className="student-resources__hero">
          <p className="student-resources__eyebrow">Vishnu Wellness Centre</p>
          <h2>A little support can make a difference.</h2>
          <p>
            College life can bring deadlines, change, relationships, uncertainty and plenty of expectations. Explore practical
            tools and supportive information to understand what you’re experiencing, try a small next step, and find support
            when you need it. You don’t have to figure everything out at once.
          </p>
          <p>
            Choose the topic that feels closest to what you’re going through. Read at your own pace and try the exercises
            that feel useful. These resources are for general education and self-reflection; they do not diagnose a condition
            or replace individual counselling. If something feels overwhelming, persistent or is affecting everyday life,
            consider contacting Vishnu Wellness Centre.
          </p>
        </header>

        <nav className="student-resources__index" aria-label="Student resource topics">
          {resources.map((resource) => (
            <button key={resource.id} type="button" onClick={() => jumpToResource(resource.id)}>
              {resource.title}
            </button>
          ))}
        </nav>

        <div className="student-resources__articles">
          {resources.map((resource) => (
            <article className="student-resources__article" id={`student-resource-${resource.id}`} key={resource.id}>
              <h3>{resource.title}</h3>
              <p className="student-resources__subtitle">{resource.subtitle}</p>
              <p>{resource.summary}</p>
              <h4>Things you can try</h4>
              <ul>
                {resource.thingsToTry.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <h4>A small step</h4>
              <p>{resource.smallStep}</p>
              <h4>When to seek more support</h4>
              <p>{resource.support}</p>
            </article>
          ))}
        </div>

        <section className="student-resources__faq">
          <h3>Frequently Asked Questions</h3>
          {faqs.map((faq) => (
            <div className="student-resources__faq-item" key={faq.question}>
              <h4>{faq.question}</h4>
              <p>{faq.answer}</p>
            </div>
          ))}
        </section>

        <section className="student-resources__safety" aria-labelledby="student-resources-safety-heading">
          <h3 id="student-resources-safety-heading">Support and safety</h3>
          <p>
            For routine counselling or wellness support, use the approved booking/contact option in the web application.
            These resources are educational and should be reviewed by the Vishnu Wellness Centre before publication.
            For immediate danger, contact local emergency services or go to the nearest hospital.
          </p>
        </section>

        <section className="student-resources__cards">
          <h3>Resource-card guide</h3>
          <ul>
            {resources.map((resource) => (
              <li key={resource.id}><strong>{resource.title}</strong> — {resource.subtitle}.</li>
            ))}
          </ul>
        </section>

        <section className="student-resources__governance">
          <h3>Content governance note</h3>
          <p>
            This content is educational and should be reviewed by the Vishnu Wellness Centre clinical lead before
            publication. Verify contact details, referral routes, emergency wording, confidentiality statements and
            institutional policies. Avoid claims that an exercise is guaranteed to reduce symptoms or that these
            resources diagnose or treat a condition.
          </p>
        </section>

        <section className="student-resources__website-email">
          <h3>Email to the website team</h3>
          <p><strong>Subject:</strong> Upload Student Wellness Resources Content to Vishnu Wellness Centre Web Application</p>
          <p>Dear Website Team,</p>
          <p>
            Please find attached the Student Wellness Resources content pack for the Vishnu Wellness Centre web
            application. Kindly create a Student Wellness Resources landing page and add the ten resource categories as
            clickable cards. Each card should open its corresponding article, including practical exercises, a suggested
            small step and guidance on when to seek further support.
          </p>
          <p>
            Please ensure the content is mobile-friendly, accessible and easy to navigate. Add the approved counselling
            booking/contact action and safety notice where indicated. Before publishing, confirm the support contact number
            is current and ensure links and referral workflows are functional. Please do not describe these educational
            resources as diagnostic tools or clinical treatment.
          </p>
          <p>Kindly share a preview for review before making the content live.</p>
          <p>
            Regards,<br />
            Ram Prudhvi Teja<br />
            Senior Psychologist | Team Lead<br />
            Vishnu Wellness Centre<br />
            Sri Vishnu Educational Society
          </p>
        </section>
      </div>
    </Modal>
  );
}
