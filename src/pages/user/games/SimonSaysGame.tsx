import { useRef, useState } from "react";
import { Button } from "../../../components/common/Button";
import { useBestScore } from "../../../hooks/useBestScore";
import "./SimonSaysGame.css";

type Mode = "idle" | "playback" | "input" | "gameover";

const PAD_COUNT = 4;

function randomPad(): number {
  return Math.floor(Math.random() * PAD_COUNT);
}

export function SimonSaysGame() {
  const [sequence, setSequence] = useState<number[]>([]);
  const [mode, setMode] = useState<Mode>("idle");
  const [activePad, setActivePad] = useState<number | null>(null);
  const [playerStep, setPlayerStep] = useState(0);
  const { best, submit } = useBestScore("simon-says", "higher");
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  function clearTimers() {
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];
  }

  function playback(seq: number[]) {
    setMode("playback");
    seq.forEach((pad, i) => {
      timeouts.current.push(
        setTimeout(() => setActivePad(pad), i * 700),
        setTimeout(() => setActivePad(null), i * 700 + 400),
      );
    });
    timeouts.current.push(
      setTimeout(
        () => {
          setPlayerStep(0);
          setMode("input");
        },
        seq.length * 700,
      ),
    );
  }

  function start() {
    clearTimers();
    const first = [randomPad()];
    setSequence(first);
    playback(first);
  }

  function handlePad(index: number) {
    if (mode !== "input") return;
    setActivePad(index);
    setTimeout(() => setActivePad(null), 200);

    if (sequence[playerStep] !== index) {
      submit(sequence.length - 1);
      setMode("gameover");
      return;
    }

    if (playerStep + 1 === sequence.length) {
      const next = [...sequence, randomPad()];
      setSequence(next);
      setTimeout(() => playback(next), 500);
    } else {
      setPlayerStep((s) => s + 1);
    }
  }

  return (
    <div className="game-shell">
      <h2 className="game-shell__title">Pattern Memory</h2>
      <div className="game-shell__stats">
        <div className="game-shell__stat">
          <span className="game-shell__stat-value">{sequence.length > 0 ? sequence.length - 1 : 0}</span>
          <span className="game-shell__stat-label">Round</span>
        </div>
        <div className="game-shell__stat">
          <span className="game-shell__stat-value">{best ?? "—"}</span>
          <span className="game-shell__stat-label">Best</span>
        </div>
      </div>

      <p className="game-shell__status">
        {mode === "idle" && "Press Start and watch the pattern."}
        {mode === "playback" && "Watch closely…"}
        {mode === "input" && "Your turn — repeat the pattern."}
        {mode === "gameover" && `Game over — you reached round ${sequence.length - 1}.`}
      </p>

      <div className="simon__grid">
        {Array.from({ length: PAD_COUNT }, (_, i) => (
          <button
            key={i}
            type="button"
            className={`simon__pad simon__pad--${i}${activePad === i ? " simon__pad--active" : ""}`}
            disabled={mode !== "input"}
            onClick={() => handlePad(i)}
          />
        ))}
      </div>

      <Button type="button" onClick={start}>
        {mode === "idle" ? "Start" : "Restart"}
      </Button>
    </div>
  );
}
