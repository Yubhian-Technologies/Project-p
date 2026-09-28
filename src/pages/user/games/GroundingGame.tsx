import { useState } from "react";
import { Button } from "../../../components/common/Button";
import { completeExercise } from "../../../services/wellnessScore";
import "./GroundingGame.css";

interface Step {
  sense: string;
  count: number;
  prompt: string;
  placeholder: string;
}

// Classic anxiety-grounding technique: name things you can perceive right now,
// counting down 5-4-3-2-1 across the five senses, to pull attention out of
// racing thoughts and back into the present moment.
const STEPS: Step[] = [
  {
    sense: "See",
    count: 5,
    prompt: "Name five things you can see around you.",
    placeholder: "e.g. a pen, a desk, a tree outside…",
  },
  {
    sense: "Touch",
    count: 4,
    prompt: "Notice four things you can physically feel or touch.",
    placeholder: "e.g. your feet on the floor, your shirt fabric…",
  },
  {
    sense: "Hear",
    count: 3,
    prompt: "Listen for three distinct sounds in your environment.",
    placeholder: "e.g. a fan humming, birds chirping…",
  },
  {
    sense: "Smell",
    count: 2,
    prompt: "Identify two things you can smell.",
    placeholder: "e.g. soap, coffee, fresh air…",
  },
  {
    sense: "Taste",
    count: 1,
    prompt: "Notice one thing you can taste.",
    placeholder: "e.g. mint, a sip of water…",
  },
];

// There's no way to fact-check what someone else can personally see, hear or
// taste right now — this is a mindfulness exercise, not a quiz with a single
// correct answer. "Correct" here means they actually paused and wrote
// something down for each sense, so this checks completion, not content.
function stepIsComplete(answers: string[]): boolean {
  return answers.every((a) => a.trim().length > 0);
}

export function GroundingGame() {
  const [stepIndex, setStepIndex] = useState(0);
  const [answersByStep, setAnswersByStep] = useState<string[][]>(() => STEPS.map((s) => Array(s.count).fill("")));
  const [checked, setChecked] = useState(false);
  const [finished, setFinished] = useState(false);

  const step = STEPS[stepIndex];
  const answers = answersByStep[stepIndex];
  const complete = stepIsComplete(answers);

  function setAnswer(i: number, value: string) {
    setChecked(false);
    setAnswersByStep((prev) => {
      const next = prev.map((a) => [...a]);
      next[stepIndex][i] = value;
      return next;
    });
  }

  function handleCheck() {
    setChecked(true);
  }

  function handleNext() {
    if (stepIndex + 1 < STEPS.length) {
      setStepIndex((i) => i + 1);
      setChecked(false);
    } else {
      completeExercise();
      setFinished(true);
    }
  }

  function handleRestart() {
    setStepIndex(0);
    setAnswersByStep(STEPS.map((s) => Array(s.count).fill("")));
    setChecked(false);
    setFinished(false);
  }

  if (finished) {
    return (
      <div className="grounding-shell">
        <div className="grounding-done">
          <span className="grounding-done__emoji">🎉</span>
          <h2 className="grounding-shell__title">Grounding complete!</h2>
          <p className="grounding-shell__subtitle">
            You just walked yourself through sight, touch, sound, smell and taste — that's the whole 5-4-3-2-1
            technique. Nice work coming back to the present moment.
          </p>
          <Button type="button" onClick={handleRestart}>
            Do it again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grounding-shell">
      <div className="grounding-shell__header">
        <h2 className="grounding-shell__title">5-4-3-2-1 Grounding Technique</h2>
        <p className="grounding-shell__subtitle">
          A quick anxiety-grounding exercise — work through your five senses, one at a time.
        </p>
      </div>

      <div className="grounding-steps">
        {STEPS.map((s, i) => (
          <span
            key={s.sense}
            className={`grounding-steps__dot${i === stepIndex ? " grounding-steps__dot--active" : ""}${
              i < stepIndex ? " grounding-steps__dot--done" : ""
            }`}
          >
            {s.count}
          </span>
        ))}
      </div>

      <div className="grounding-card">
        <div className="grounding-card__heading">
          <h3 className="grounding-card__title">
            {step.count} — {step.sense}
          </h3>
          <p className="grounding-card__prompt">{step.prompt}</p>
        </div>

        <div className="grounding-inputs">
          {answers.map((value, i) => (
            <input
              key={i}
              type="text"
              className="grounding-input"
              value={value}
              placeholder={i === 0 ? step.placeholder : `Thing ${i + 1}…`}
              onChange={(e) => setAnswer(i, e.target.value)}
            />
          ))}
        </div>

        {checked && (
          <p className={`grounding-result${complete ? " grounding-result--right" : " grounding-result--wrong"}`}>
            {complete
              ? "✅ Yay, you're right! You noticed all of them."
              : `❌ Not quite yet — fill in all ${step.count} boxes before moving on.`}
          </p>
        )}

        <div className="grounding-actions">
          {complete && checked ? (
            <Button type="button" onClick={handleNext}>
              {stepIndex + 1 < STEPS.length ? `Next: ${STEPS[stepIndex + 1].sense} (${STEPS[stepIndex + 1].count}) →` : "Finish →"}
            </Button>
          ) : (
            <Button type="button" onClick={handleCheck}>
              Check my answers
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
