import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/common/Button";
import { useBestScore } from "../../../hooks/useBestScore";
import "./BreatheFocusGame.css";

type Phase = "inhale" | "hold-in" | "exhale" | "hold-out";

const PHASE_MS = 4000;
const PHASE_LABEL: Record<Phase, string> = {
  inhale: "Breathe in…",
  "hold-in": "Hold",
  exhale: "Breathe out…",
  "hold-out": "Hold",
};
const NEXT_PHASE: Record<Phase, Phase> = {
  inhale: "hold-in",
  "hold-in": "exhale",
  exhale: "hold-out",
  "hold-out": "inhale",
};

export function BreatheFocusGame() {
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<Phase>("inhale");
  const [elapsed, setElapsed] = useState(0);
  const { best, submit } = useBestScore("breathe-focus", "higher");

  useEffect(() => {
    if (!running) return;
    const phaseTimer = setTimeout(() => setPhase((p) => NEXT_PHASE[p]), PHASE_MS);
    return () => clearTimeout(phaseTimer);
  }, [running, phase]);

  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(tick);
  }, [running]);

  const stoppedRef = useRef(false);

  function start() {
    stoppedRef.current = false;
    setPhase("inhale");
    setElapsed(0);
    setRunning(true);
  }

  function stop() {
    if (!stoppedRef.current) {
      stoppedRef.current = true;
      submit(elapsed);
    }
    setRunning(false);
  }

  return (
    <div className="game-shell">
      <h2 className="game-shell__title">Breathe & Focus</h2>
      <div className="game-shell__stats">
        <div className="game-shell__stat">
          <span className="game-shell__stat-value">{elapsed}s</span>
          <span className="game-shell__stat-label">This session</span>
        </div>
        <div className="game-shell__stat">
          <span className="game-shell__stat-value">{best ?? "—"}{best !== null ? "s" : ""}</span>
          <span className="game-shell__stat-label">Longest</span>
        </div>
      </div>

      <div className={`breathe__circle breathe__circle--${running ? phase : "idle"}`}>
        <span>{running ? PHASE_LABEL[phase] : "Ready?"}</span>
      </div>

      {running ? (
        <Button type="button" variant="outlined" onClick={stop}>
          Stop
        </Button>
      ) : (
        <Button type="button" onClick={start}>
          Start
        </Button>
      )}
    </div>
  );
}
