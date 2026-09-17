import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/common/Button";
import { completeExercise } from "../../../services/wellnessScore";
import "./Breathing478Game.css";

type PhaseId = "inhale" | "hold" | "exhale";

export function Breathing478Game() {
  const [running, setRunning] = useState(false);
  const [secInCycle, setSecInCycle] = useState(0);
  const [cycles, setCycles] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;

    timerRef.current = setInterval(() => {
      setTotalSeconds((s) => s + 1);

      setSecInCycle((prevSec) => {
        const nextSec = prevSec + 1;
        if (nextSec >= 19) {
          // Completed full 19-second cycle (4s + 7s + 8s)
          setCycles((c) => c + 1);
          completeExercise();
          return 0;
        }
        return nextSec;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [running]);

  function start() {
    setSecInCycle(0);
    setCycles(0);
    setTotalSeconds(0);
    setRunning(true);
    completeExercise();
  }

  function stop() {
    setRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  // Derive current phase & countdown from secInCycle (0..18)
  let phaseId: PhaseId = "inhale";
  let phaseLabel = "Inhale for 4s";
  let timeLeft = 4;

  if (secInCycle < 4) {
    phaseId = "inhale";
    phaseLabel = "Inhale for 4s";
    timeLeft = 4 - secInCycle;
  } else if (secInCycle < 11) {
    phaseId = "hold";
    phaseLabel = "Hold for 7s";
    timeLeft = 11 - secInCycle; // 7 down to 1
  } else {
    phaseId = "exhale";
    phaseLabel = "Exhale for 8s";
    timeLeft = 19 - secInCycle; // 8 down to 1
  }

  return (
    <div className="b478-shell">
      <div className="b478-shell__header">
        <h2 className="b478-shell__title">4-7-8 Breathing Technique</h2>
        <p className="b478-shell__subtitle">
          Inhale quietly through your nose for 4 seconds, hold for 7 seconds, and exhale through your mouth for 8 seconds to deeply relax your nervous system.
        </p>
      </div>

      <div className="b478-stats">
        <div className="b478-stat">
          <span className="b478-stat__val">{cycles}</span>
          <span className="b478-stat__label">Cycles Completed</span>
        </div>
        <div className="b478-stat">
          <span className="b478-stat__val">{totalSeconds}s</span>
          <span className="b478-stat__label">Total Duration</span>
        </div>
      </div>

      <div className={`b478-circle b478-circle--${running ? phaseId : "idle"}`}>
        <div className="b478-circle__inner">
          <span className="b478-circle__timer">{running ? `${timeLeft}s` : "4-7-8"}</span>
          <span className="b478-circle__label">{running ? phaseLabel : "Ready to Relax?"}</span>
        </div>
      </div>

      <div className="b478-actions">
        {running ? (
          <Button type="button" variant="outlined" onClick={stop}>
            Stop Practice
          </Button>
        ) : (
          <Button type="button" onClick={start}>
            Start 4-7-8 Breathing
          </Button>
        )}
      </div>
    </div>
  );
}


