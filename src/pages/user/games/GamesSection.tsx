import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import type { ReactNode } from "react";
import { BentoCard } from "../../../components/common/BentoCard";
import {
  MoonIcon,
  SquareIcon,
  SparklesIcon,
  WindIcon,
  LeafIcon,
  StarIcon,
  Grid3x3Icon,
  TargetIcon,
} from "../../../components/common/icons";
import { useAuth } from "../../../hooks/useAuth";
import { MemoryMatchGame } from "./MemoryMatchGame";
import { BreatheFocusGame } from "./BreatheFocusGame";
import { Breathing478Game } from "./Breathing478Game";
import { BoxBreathingGame } from "./BoxBreathingGame";
import { MeditationGame } from "./MeditationGame";
import { SimonSaysGame } from "./SimonSaysGame";
import { TicTacToeGame } from "./TicTacToeGame";
import { GroundingGame } from "./GroundingGame";
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
  | "tic-tac-toe"
  | "grounding";

const GAMES: {
  id: GameId;
  title: string;
  subtitle: string;
  icon: ReactNode;
  /** A short, plain-language nudge — this is a wellness exercise, not a test. */
  motivation: string;
  /** One easy-to-understand fact about why the exercise actually helps. */
  fact: string;
}[] = [
  {
    id: "breathe-478",
    title: "4-7-8 Breathing Technique",
    subtitle: "Inhale 4s, hold 7s, exhale 8s for deep nerve relaxation.",
    icon: <MoonIcon />,
    motivation: "You've got this — just three slow rounds can calm your whole body down.",
    fact: "This pattern is sometimes called a “natural tranquilizer” for your nervous system.",
  },
  {
    id: "box-breathing",
    title: "Box Breathing (4x4)",
    subtitle: "Equal 4s inhale, hold, exhale, hold pattern for instant focus.",
    icon: <SquareIcon />,
    motivation: "One box, four sides, zero pressure — you can do this in under a minute.",
    fact: "It's the same technique Navy SEALs use to stay calm and focused under real pressure.",
  },
  {
    id: "meditation",
    title: "Mindful Meditation",
    subtitle: "Selectable 30s, 40s, or 60s meditation modules.",
    icon: <SparklesIcon />,
    motivation: "Even 30 seconds of stillness counts — you're doing great just by starting.",
    fact: "Short, regular sessions like this have been shown to lower cortisol, your body's main stress hormone.",
  },
  {
    id: "breathe-focus",
    title: "Guided Breathe & Focus",
    subtitle: "A slow guided breathing cycle to help you reset.",
    icon: <WindIcon />,
    motivation: "Slow down for a minute — your mind will thank you.",
    fact: "Slowing your breathing rate can lower your heart rate within seconds.",
  },
  {
    id: "memory-match",
    title: "Memory Match",
    subtitle: "Flip cards and find every pair in as few moves as possible.",
    icon: <LeafIcon />,
    motivation: "Have fun with it — every round trains your focus a little more.",
    fact: "Simple memory games like this activate the hippocampus, your brain's memory center.",
  },
  {
    id: "simon-says",
    title: "Pattern Memory",
    subtitle: "Watch the sequence, then repeat it back.",
    icon: <StarIcon />,
    motivation: "Take your time — watching closely is half the game.",
    fact: "Recalling a sequence like this uses your “working memory,” the same skill that helps you follow instructions.",
  },
  {
    id: "tic-tac-toe",
    title: "Tic-Tac-Toe",
    subtitle: "A quick, light-hearted round against the computer.",
    icon: <Grid3x3Icon />,
    motivation: "No pressure here — it's just a fun little break.",
    fact: "A quick, low-stakes game like this can help reset your attention span in minutes.",
  },
  {
    id: "grounding",
    title: "5-4-3-2-1 Grounding Technique",
    subtitle: "Notice 5 things you see, 4 you touch, 3 you hear, 2 you smell, 1 you taste.",
    icon: <TargetIcon />,
    motivation: "You can do it — just notice what's already around you, right now.",
    fact: "Therapists often use this exact technique to interrupt anxiety by re-engaging your five senses.",
  },
];

export interface GamesSectionHandle {
  /** Lets the page header's own back button (see AppShell's
   *  titleLeadingAction) close whichever exercise is currently open. */
  goBack: () => void;
}

interface GamesSectionProps {
  /** Told whenever an exercise opens/closes, so the dashboard shell knows
   *  whether to show a back button beside the "Wellness Exercise" title. */
  onActiveChange?: (active: boolean) => void;
}

export const GamesSection = forwardRef<GamesSectionHandle, GamesSectionProps>(function GamesSection(
  { onActiveChange },
  ref,
) {
  const { role } = useAuth();
  const [activeGame, setActiveGame] = useState<GameId | null>(null);

  useEffect(() => {
    onActiveChange?.(activeGame !== null);
  }, [activeGame, onActiveChange]);

  useImperativeHandle(ref, () => ({
    goBack: () => setActiveGame(null),
  }));

  if (activeGame) {
    const current = GAMES.find((g) => g.id === activeGame);
    return (
      <div className="games-section">
        {/* Side by side on a wide screen, stacked on a narrow one, with a
            fixed breakpoint rather than flex-wrap — flex-wrap's continuous
            reflow left the motivation card squeezed into a narrow sliver at
            some in-between widths instead of cleanly stacking. */}
        <div className="games-section__active-row">
          <div className="games-section__active-game">
            {activeGame === "breathe-478" && <Breathing478Game />}
            {activeGame === "box-breathing" && <BoxBreathingGame />}
            {activeGame === "meditation" && <MeditationGame />}
            {activeGame === "memory-match" && <MemoryMatchGame />}
            {activeGame === "breathe-focus" && <BreatheFocusGame />}
            {activeGame === "simon-says" && <SimonSaysGame />}
            {activeGame === "tic-tac-toe" && <TicTacToeGame />}
            {activeGame === "grounding" && <GroundingGame />}
          </div>

          {/* A second, separate card for the motivation + fact — kept out of
              the exercise's own card so the exercise itself stays uncluttered. */}
          {current && (
            <div className="games-section__motivation-card">
              <p className="games-section__motivation-card-title">While you're at it</p>
              <p className="games-section__motivation">💪 {current.motivation}</p>
              <p className="games-section__fact">
                <strong>Did you know?</strong> {current.fact}
              </p>
            </div>
          )}
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
        <div style={{ marginTop: 24, width: "100%" }}>
          <ChallengesCard />
        </div>
      )}
    </div>
  );
});
