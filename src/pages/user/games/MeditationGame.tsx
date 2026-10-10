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
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Created/resumed from inside the "Start Meditation" click (a real user
  // gesture) so the browser's autoplay policy doesn't block it later when
  // the beep needs to fire on its own, unattended, at timer completion.
  function ensureAudioContext(): AudioContext | null {
    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return null;
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContextCtor();
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume().catch(() => {});
    return audioCtxRef.current;
  }

  function playBeep() {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.5);
  }

  useEffect(() => {
    return () => {
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!running) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          setCompleted(true);
          completeExercise();
          playBeep();
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
    ensureAudioContext();
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
          style={{ background: `conic-gradient(#0D9488 ${progressPercent}%, #CCFBF1 0%)` }}
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
