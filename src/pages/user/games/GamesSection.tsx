import { useState } from "react";
import type { ReactNode } from "react";
import { BentoCard } from "../../../components/common/BentoCard";
import { Button } from "../../../components/common/Button";
import {
  MoonIcon,
  SquareIcon,
  SparklesIcon,
  WindIcon,
  LeafIcon,
  StarIcon,
  Grid3x3Icon,
} from "../../../components/common/icons";
import { useAuth } from "../../../hooks/useAuth";
import { MemoryMatchGame } from "./MemoryMatchGame";
import { BreatheFocusGame } from "./BreatheFocusGame";
import { Breathing478Game } from "./Breathing478Game";
import { BoxBreathingGame } from "./BoxBreathingGame";
import { MeditationGame } from "./MeditationGame";
import { SimonSaysGame } from "./SimonSaysGame";
import { TicTacToeGame } from "./TicTacToeGame";
import { ChallengesCard } from "./ChallengesCard";
import "../../../styles/bento-grid.css";
import "./GamesSection.css";

type GameId =
  | "breathe-478"
  | "box-breathing"
  | "meditation"
  | "memory-match"
  | "breathe-focus"
  | "simon-says"
  | "tic-tac-toe";

const GAMES: { id: GameId; title: string; subtitle: string; icon: ReactNode }[] = [
  {
    id: "breathe-478",
    title: "4-7-8 Breathing Technique",
    subtitle: "Inhale 4s, hold 7s, exhale 8s for deep nerve relaxation.",
    icon: <MoonIcon />,
  },
  {
    id: "box-breathing",
    title: "Box Breathing (4x4)",
    subtitle: "Equal 4s inhale, hold, exhale, hold pattern for instant focus.",
    icon: <SquareIcon />,
  },
  {
    id: "meditation",
    title: "Mindful Meditation",
    subtitle: "Selectable 30s, 40s, or 60s meditation modules.",
    icon: <SparklesIcon />,
  },
  {
    id: "breathe-focus",
    title: "Guided Breathe & Focus",
    subtitle: "A slow guided breathing cycle to help you reset.",
    icon: <WindIcon />,
  },
  {
    id: "memory-match",
    title: "Memory Match",
    subtitle: "Flip cards and find every pair in as few moves as possible.",
    icon: <LeafIcon />,
  },
  {
    id: "simon-says",
    title: "Pattern Memory",
    subtitle: "Watch the sequence, then repeat it back.",
    icon: <StarIcon />,
  },
  {
    id: "tic-tac-toe",
    title: "Tic-Tac-Toe",
    subtitle: "A quick, light-hearted round against the computer.",
    icon: <Grid3x3Icon />,
  },
];

export function GamesSection() {
  const { role } = useAuth();
  const [activeGame, setActiveGame] = useState<GameId | null>(null);

  if (activeGame) {
    return (
      <div className="games-section">
        <Button type="button" variant="outlined" onClick={() => setActiveGame(null)}>
          ← Back to Wellness Exercises
        </Button>

        <div style={{ marginTop: 20 }}>
          {activeGame === "breathe-478" && <Breathing478Game />}
          {activeGame === "box-breathing" && <BoxBreathingGame />}
          {activeGame === "meditation" && <MeditationGame />}
          {activeGame === "memory-match" && <MemoryMatchGame />}
          {activeGame === "breathe-focus" && <BreatheFocusGame />}
          {activeGame === "simon-says" && <SimonSaysGame />}
          {activeGame === "tic-tac-toe" && <TicTacToeGame />}
        </div>
      </div>
    );
  }

  return (
    <div className="games-section">
      <p className="games-section__intro">
        Interactive wellness exercises and breathing techniques to take a breather and boost your mental wellbeing.
      </p>

      <div className="bento-grid">
        {GAMES.map((game) => (
          <BentoCard
            key={game.id}
            span={6}
            title={game.title}
            subtitle={game.subtitle}
            icon={game.icon}
            action={{ label: "Start Exercise →", onClick: () => setActiveGame(game.id) }}
          />
        ))}
      </div>

      {/* Daily Challenges Card at bottom for users only */}
      {role === "user" && (
        <div style={{ marginTop: 24 }}>
          <ChallengesCard />
        </div>
      )}
    </div>
  );
}


