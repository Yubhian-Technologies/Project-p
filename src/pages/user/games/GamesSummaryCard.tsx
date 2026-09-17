import { useEffect, useState } from "react";
import { BentoCard } from "../../../components/common/BentoCard";
import { GamepadIcon } from "../../../components/common/icons";
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
      title="Wellness Exercise"
      subtitle="Take a short break with a few relaxing mind games."
      action={{ label: "Play Wellness Exercise →", onClick: onPlay }}
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
