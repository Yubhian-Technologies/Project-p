import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/common/Button";
import { completeExercise } from "../../../services/wellnessScore";
import "./MeditationGame.css";

type DurationOption = 30 | 40 | 60;

const DURATIONS: DurationOption[] = [30, 40, 60];

export function MeditationGame() {
  const [selectedDuration, setSelectedDuration] = useState<DurationOption>(60);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          setCompleted(true);
          completeExercise();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [running]);

  function handleSelectDuration(dur: DurationOption) {
    if (running) return;
    setSelectedDuration(dur);
    setTimeLeft(dur);
    setCompleted(false);
  }

  function start() {
    if (timeLeft === 0) setTimeLeft(selectedDuration);
    setCompleted(false);
    setRunning(true);
    completeExercise();
  }

  function pause() {
    setRunning(false);
  }

  function reset() {
    setRunning(false);
    setTimeLeft(selectedDuration);
    setCompleted(false);
  }

  const progressPercent = ((selectedDuration - timeLeft) / selectedDuration) * 100;

  return (
    <div className="med-shell">
      <div className="med-shell__header">
        <h2 className="med-shell__title">Mindful Meditation</h2>
        <p className="med-shell__subtitle">
          Choose your session duration module below, close your eyes, focus on your breath, and clear your mind.
        </p>
      </div>

      {/* Duration modules */}
      <div className="med-modules">
        <span className="med-modules__label">Select Duration Module:</span>
        <div className="med-modules__btns">
          {DURATIONS.map((dur) => (
            <button
              key={dur}
              type="button"
              className={`med-module-btn${selectedDuration === dur ? " med-module-btn--active" : ""}`}
              disabled={running}
              onClick={() => handleSelectDuration(dur)}
            >
              {dur} Secs
            </button>
          ))}
        </div>
      </div>

      {/* Meditation Visual Circle */}
      <div className={`med-visual ${running ? "med-visual--pulsing" : ""}`}>
        <div
          className="med-visual__progress-ring"
          style={{ background: `conic-gradient(#5A61C0 ${progressPercent}%, #EDE9FE 0%)` }}
        />
        <div className="med-visual__content">
          <span className="med-visual__timer">{timeLeft}s</span>
          <span className="med-visual__status">
            {completed
              ? "Session Complete! 🎉"
              : running
              ? "Breathe & Meditate…"
              : "Ready to Start"}
          </span>
        </div>
      </div>

      {completed && (
        <div className="med-completed-banner">
          ✨ Excellent! You completed a {selectedDuration}s Mindful Meditation session and earned wellness points!
        </div>
      )}

      <div className="med-actions">
        {!running ? (
          <Button type="button" onClick={start}>
            {timeLeft < selectedDuration && timeLeft > 0 ? "Resume Meditation" : "Start Meditation"}
          </Button>
        ) : (
          <Button type="button" variant="outlined" onClick={pause}>
            Pause
          </Button>
        )}
        <Button type="button" variant="outlined" onClick={reset}>
          Reset
        </Button>
      </div>
    </div>
  );
}
