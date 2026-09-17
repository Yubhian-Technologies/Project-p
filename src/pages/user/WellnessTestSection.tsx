import { useState } from "react";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import "./WellnessTestSection.css";

interface Question {
  id: number;
  text: string;
}

const QUESTIONS: Question[] = [
  { id: 1, text: "How often do you feel overwhelmed by your academic, work, or daily responsibilities?" },
  { id: 2, text: "How often do you have difficulty relaxing, falling asleep, or hushing racing thoughts?" },
  { id: 3, text: "How often do you experience physical stress symptoms like muscle tension, headaches, or fatigue?" },
  { id: 4, text: "How often do you feel anxious, nervous, or on edge about upcoming tasks or events?" },
  { id: 5, text: "How often do you feel emotional stress is affecting your concentration, mood, or patience?" },
  { id: 6, text: "How often do you feel like you are struggling to manage or control key stressors in your life?" },
];

const OPTIONS = [
  { label: "Never", value: 0 },
  { label: "Rarely", value: 1 },
  { label: "Sometimes", value: 2 },
  { label: "Often", value: 3 },
  { label: "Very Often", value: 4 },
];

interface WellnessTestSectionProps {
  onBookSession: () => void;
}

export function WellnessTestSection({ onBookSession }: WellnessTestSectionProps) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const answeredCount = Object.keys(answers).length;
  const isComplete = answeredCount === QUESTIONS.length;

  const totalScore = Object.values(answers).reduce((sum, val) => sum + val, 0);

  function handleSelectOption(questionId: number, value: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function handleSubmit() {
    if (isComplete) {
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handleReset() {
    setAnswers({});
    setSubmitted(false);
  }

  function getStressResult(score: number) {
    if (score <= 7) {
      return {
        level: "low",
        badge: "ALL WELL",
        badgeBg: "#D1FAE5",
        badgeColor: "#065F46",
        title: "All Well! Your Stress Levels are Low & Balanced",
        description:
          "Great job maintaining your mental well-being! Your answers indicate that your current stress levels are healthy and well managed.",
        suggestions: [
          "Continue your regular self-care routines, adequate sleep, and hydration.",
          "Keep engaging in physical activities, creative hobbies, or outdoor time.",
          "Maintain open communication and social connection with friends and family.",
          "Practice daily gratitude or journaling to keep a positive mindset.",
        ],
      };
    }
    if (score <= 15) {
      return {
        level: "moderate",
        badge: "MODERATE STRESS",
        badgeBg: "#FEF3C7",
        badgeColor: "#92400E",
        title: "Moderate Stress Level Detected",
        description:
          "You are experiencing a noticeable amount of stress. Taking proactive, small daily wellness steps can help prevent burnout and restore balance.",
        suggestions: [
          "Take 5-minute deep breathing or mindfulness breaks during study or work sessions.",
          "Break down overwhelming tasks into smaller, achievable micro-goals.",
          "Prioritize 7–8 hours of restful sleep and reduce screen time before bed.",
          "Consider scheduling a 1-on-1 session with a counsellor for personalized guidance.",
        ],
      };
    }
    return {
      level: "high",
      badge: "HIGH STRESS ALERT",
      badgeBg: "#FEE2E2",
      badgeColor: "#991B1B",
      title: "High Stress Alert — We Recommend Support",
      description:
        "Your answers indicate high stress levels. Please remember you don't have to navigate this alone — our wellness team is here to support you.",
      suggestions: [
        "Connect with a certified counsellor for professional, confidential support.",
        "Pause non-essential high-pressure tasks and give yourself permission to rest.",
        "Use 5-4-3-2-1 sensory grounding techniques when feeling anxious or overwhelmed.",
        "Reach out to our 24/7 Crisis SOS support if you feel in immediate distress.",
      ],
    };
  }

  const result = getStressResult(totalScore);

  return (
    <div className="wellness-test">
      <Card className="wellness-test__header-card">
        <h2 className="wellness-test__title">Wellness Stress Assessment</h2>
        <p className="wellness-test__subtitle">
          Take a moment to check in with yourself. Answer the questions below to evaluate your current stress levels
          and receive personalized wellness recommendations.
        </p>
      </Card>

      {!submitted ? (
        <div className="wellness-test__form">
          <div className="wellness-test__progress">
            <div className="wellness-test__progress-text">
              Question <strong>{answeredCount}</strong> of <strong>{QUESTIONS.length}</strong> answered
            </div>
            <div className="wellness-test__progress-bar">
              <div
                className="wellness-test__progress-fill"
                style={{ width: `${(answeredCount / QUESTIONS.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="wellness-test__questions">
            {QUESTIONS.map((q, idx) => (
              <Card key={q.id} className="wellness-test__question-card">
                <p className="wellness-test__question-text">
                  <span className="wellness-test__question-num">{idx + 1}.</span> {q.text}
                </p>

                <div className="wellness-test__options">
                  {OPTIONS.map((opt) => {
                    const isSelected = answers[q.id] === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={isSelected}
                        className={`wellness-test__option-btn ${
                          isSelected ? "wellness-test__option-btn--active" : ""
                        }`}
                        onClick={() => handleSelectOption(q.id, opt.value)}
                      >
                        <span className="wellness-test__option-label">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>

          <div className="wellness-test__submit-bar">
            <Button
              type="button"
              disabled={!isComplete}
              onClick={handleSubmit}
              className="wellness-test__submit-btn"
            >
              Calculate Stress Level
            </Button>
            {!isComplete && (
              <span className="wellness-test__incomplete-hint">
                Please answer all questions to calculate your stress level.
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="wellness-test__results">
          <Card className="wellness-test__result-card">
            <div className="wellness-test__result-head">
              <span
                className="wellness-test__result-badge"
                style={{ background: result.badgeBg, color: result.badgeColor }}
              >
                {result.badge}
              </span>
              <span className="wellness-test__result-score">
                Score: <strong>{totalScore}</strong> / {QUESTIONS.length * 4}
              </span>
            </div>

            <h3 className="wellness-test__result-title">{result.title}</h3>
            <p className="wellness-test__result-desc">{result.description}</p>

            <div className="wellness-test__suggestions-block">
              <h4 className="wellness-test__suggestions-heading">Personalized Suggestions for You:</h4>
              <ul className="wellness-test__suggestions-list">
                {result.suggestions.map((item, i) => (
                  <li key={i} className="wellness-test__suggestion-item">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="wellness-test__result-actions">
              <Button type="button" onClick={onBookSession} className="wellness-test__book-btn">
                Book Session with Counsellor
              </Button>
              <Button type="button" variant="outlined" onClick={handleReset}>
                Retake Test
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
