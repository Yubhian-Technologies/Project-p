import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/common/Button";
import { completeExercise } from "../../../services/wellnessScore";
import "./BoxBreathingGame.css";

type BoxPhaseId = "inhale" | "hold1" | "exhale" | "hold2";

export function BoxBreathingGame() {
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
        if (nextSec >= 16) {
          // Completed full 16-second box cycle (4s + 4s + 4s + 4s)
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

  // Derive current box phase & countdown from secInCycle (0..15)
  let phaseId: BoxPhaseId = "inhale";
  let phaseLabel = "Inhale for 4s";
  let timeLeft = 4;

  if (secInCycle < 4) {
    phaseId = "inhale";
    phaseLabel = "Inhale for 4s";
    timeLeft = 4 - secInCycle;
  } else if (secInCycle < 8) {
    phaseId = "hold1";
    phaseLabel = "Hold for 4s";
    timeLeft = 8 - secInCycle;
  } else if (secInCycle < 12) {
    phaseId = "exhale";
    phaseLabel = "Exhale for 4s";
    timeLeft = 12 - secInCycle;
  } else {
    phaseId = "hold2";
    phaseLabel = "Hold for 4s";
    timeLeft = 16 - secInCycle;
  }

  return (
    <div className="boxb-shell">
      <div className="boxb-shell__header">
        <h2 className="boxb-shell__title">Box Breathing Technique</h2>
        <p className="boxb-shell__subtitle">
          Also known as 4x4 breathing — used by Navy SEALs to lower stress, sharpen focus, and regain mental clarity.
        </p>
      </div>

      <div className="boxb-stats">
        <div className="boxb-stat">
          <span className="boxb-stat__val">{cycles}</span>
          <span className="boxb-stat__label">Box Cycles</span>
        </div>
        <div className="boxb-stat">
          <span className="boxb-stat__val">{totalSeconds}s</span>
          <span className="boxb-stat__label">Total Time</span>
        </div>
      </div>

      <div className={`boxb-box boxb-box--${running ? phaseId : "idle"}`}>
        <div className="boxb-box__inner">
          <span className="boxb-box__timer">{running ? `${timeLeft}s` : "4x4"}</span>
          <span className="boxb-box__label">{running ? phaseLabel : "Ready for Box Breathing?"}</span>
        </div>
      </div>

      <div className="boxb-actions">
        {running ? (
          <Button type="button" variant="outlined" onClick={stop}>
            Stop Practice
          </Button>
        ) : (
          <Button type="button" onClick={start}>
            Start Box Breathing
          </Button>
        )}
      </div>
    </div>
  );
}


