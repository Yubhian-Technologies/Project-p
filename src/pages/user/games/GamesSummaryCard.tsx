import { useEffect, useState } from "react";
import { BentoCard } from "../../../components/common/BentoCard";
import { useBestScore } from "../../../hooks/useBestScore";
import "./GamesSummaryCard.css";

interface GameSummaryConfig {
  id: string;
  label: string;
  better: "higher" | "lower";
  unit: string;
}

const GAMES: GameSummaryConfig[] = [
  { id: "memory-match", label: "Memory Match", better: "lower", unit: " moves" },
  { id: "breathe-focus", label: "Breathe & Focus", better: "higher", unit: "s" },
  { id: "simon-says", label: "Pattern Memory", better: "higher", unit: "" },
  { id: "tic-tac-toe", label: "Tic-Tac-Toe", better: "higher", unit: " streak" },
];

const AUTO_ADVANCE_MS = 4000;

function initialIndex(): number {
  try {
    const lastPlayed = localStorage.getItem("games:last-played");
    const found = GAMES.findIndex((g) => g.id === lastPlayed);
    return found >= 0 ? found : 0;
  } catch {
    return 0;
  }
}

interface GamesSummaryCardProps {
  onPlay: () => void;
}

function GamepadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path
        d="M6.5 7C3.5 7 1 9.5 1 12.7v1.6C1 17.5 3.4 20 6.4 20c1.9 0 3.6-1 4.6-2.5l.3-.5h1.4l.3.5c1 1.5 2.7 2.5 4.6 2.5 3 0 5.4-2.5 5.4-5.7v-1.6C23 9.5 20.5 7 17.5 7c-2 0-3.8 1.1-4.7 2.7h-1.6C10.3 8.1 8.5 7 6.5 7Z"
        fill="currentColor"
      />
      <circle cx="6.4" cy="13.5" r="2.1" fill="var(--neu-bg, #E8ECF2)" />
      <circle cx="16.6" cy="11.3" r="1.1" fill="var(--neu-bg, #E8ECF2)" />
      <circle cx="18.9" cy="14.1" r="1.1" fill="var(--neu-bg, #E8ECF2)" />
    </svg>
  );
}

function GameScoreCard({ id, label, better, unit }: GameSummaryConfig) {
  const { last, best } = useBestScore(id, better);
  return (
    <div className="games-summary__card">
      <span className="games-summary__label">{label}</span>
      <span className="games-summary__score">Your score: {last !== null ? `${last}${unit}` : "—"}</span>
      <span className="games-summary__score games-summary__score--best">
        Highest score: {best !== null ? `${best}${unit}` : "—"}
      </span>
    </div>
  );
}

export function GamesSummaryCard({ onPlay }: GamesSummaryCardProps) {
  const [index, setIndex] = useState(initialIndex);
  const game = GAMES[index];

  function step(delta: number) {
    setIndex((i) => (i + delta + GAMES.length) % GAMES.length);
  }

  useEffect(() => {
    const timer = setInterval(() => step(1), AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <BentoCard
      className="games-summary-bento"
      span={4}
      icon={<GamepadIcon />}
      title="Puzzles & Games"
      subtitle="Take a short break with a few relaxing mind games."
      action={{ label: "Play Games →", onClick: onPlay }}
    >
      <div className="games-summary__carousel">
        <div className="games-summary">
          <button type="button" className="games-summary__arrow" aria-label="Previous game" onClick={() => step(-1)}>
            ‹
          </button>

          <GameScoreCard key={game.id} {...game} />

          <button type="button" className="games-summary__arrow" aria-label="Next game" onClick={() => step(1)}>
            ›
          </button>
        </div>

        <div className="games-summary__dots">
          {GAMES.map((g, i) => (
            <button
              key={g.id}
              type="button"
              className={`games-summary__dot${i === index ? " games-summary__dot--active" : ""}`}
              aria-label={`Show ${g.label}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      </div>
    </BentoCard>
  );
}
