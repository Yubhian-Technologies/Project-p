import { useState } from "react";
import { BentoCard } from "../../../components/common/BentoCard";
import { Button } from "../../../components/common/Button";
import { MemoryMatchGame } from "./MemoryMatchGame";
import { BreatheFocusGame } from "./BreatheFocusGame";
import { SimonSaysGame } from "./SimonSaysGame";
import { TicTacToeGame } from "./TicTacToeGame";
import "../../../styles/bento-grid.css";
import "./GamesSection.css";

type GameId = "memory-match" | "breathe-focus" | "simon-says" | "tic-tac-toe";

const GAMES: { id: GameId; title: string; subtitle: string; icon: string }[] = [
  {
    id: "memory-match",
    title: "Memory Match",
    subtitle: "Flip cards and find every pair in as few moves as possible.",
    icon: "🍃",
  },
  {
    id: "breathe-focus",
    title: "Breathe & Focus",
    subtitle: "A slow guided breathing cycle to help you reset.",
    icon: "🌙",
  },
  {
    id: "simon-says",
    title: "Pattern Memory",
    subtitle: "Watch the sequence, then repeat it back.",
    icon: "✨",
  },
  {
    id: "tic-tac-toe",
    title: "Tic-Tac-Toe",
    subtitle: "A quick, light-hearted round against the computer.",
    icon: "🌸",
  },
];

export function GamesSection() {
  const [activeGame, setActiveGame] = useState<GameId | null>(null);

  if (activeGame) {
    return (
      <div className="games-section">
        <Button type="button" variant="outlined" onClick={() => setActiveGame(null)}>
          ← Back to Wellness Exercise
        </Button>
        {activeGame === "memory-match" && <MemoryMatchGame />}
        {activeGame === "breathe-focus" && <BreatheFocusGame />}
        {activeGame === "simon-says" && <SimonSaysGame />}
        {activeGame === "tic-tac-toe" && <TicTacToeGame />}
      </div>
    );
  }

  return (
    <div className="games-section">
      <p className="games-section__intro">
        A few small games to take a breather between sessions — no pressure, just play.
      </p>
      <div className="bento-grid">
        {GAMES.map((game) => (
          <BentoCard
            key={game.id}
            span={6}
            title={game.title}
            subtitle={game.subtitle}
            icon={game.icon}
            action={{ label: "Play →", onClick: () => setActiveGame(game.id) }}
          />
        ))}
      </div>
    </div>
  );
}
