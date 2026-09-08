import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/common/Button";
import { useBestScore } from "../../../hooks/useBestScore";
import "./MemoryMatchGame.css";

const SYMBOLS = ["🍃", "🌙", "⭐", "☁️", "🌸", "🌿"];

interface Card {
  id: number;
  symbol: string;
  matched: boolean;
}

function shuffledDeck(): Card[] {
  const deck = [...SYMBOLS, ...SYMBOLS].map((symbol, index) => ({ id: index, symbol, matched: false }));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function MemoryMatchGame() {
  const [deck, setDeck] = useState<Card[]>(() => shuffledDeck());
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [busy, setBusy] = useState(false);
  const { best, submit } = useBestScore("memory-match", "lower");

  const won = useMemo(() => deck.every((c) => c.matched), [deck]);

  useEffect(() => {
    if (won) submit(moves);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won]);

  function handleFlip(id: number) {
    if (busy || flipped.includes(id) || deck.find((c) => c.id === id)?.matched) return;
    const next = [...flipped, id];
    setFlipped(next);

    if (next.length === 2) {
      setBusy(true);
      setMoves((m) => m + 1);
      const [a, b] = next;
      const cardA = deck.find((c) => c.id === a)!;
      const cardB = deck.find((c) => c.id === b)!;

      if (cardA.symbol === cardB.symbol) {
        setTimeout(() => {
          setDeck((d) => d.map((c) => (c.id === a || c.id === b ? { ...c, matched: true } : c)));
          setFlipped([]);
          setBusy(false);
        }, 400);
      } else {
        setTimeout(() => {
          setFlipped([]);
          setBusy(false);
        }, 800);
      }
    }
  }

  function newGame() {
    setDeck(shuffledDeck());
    setFlipped([]);
    setMoves(0);
    setBusy(false);
  }

  return (
    <div className="game-shell">
      <h2 className="game-shell__title">Memory Match</h2>
      <div className="game-shell__stats">
        <div className="game-shell__stat">
          <span className="game-shell__stat-value">{moves}</span>
          <span className="game-shell__stat-label">Moves</span>
        </div>
        <div className="game-shell__stat">
          <span className="game-shell__stat-value">{best ?? "—"}</span>
          <span className="game-shell__stat-label">Best</span>
        </div>
      </div>

      <div className="memory-match__grid">
        {deck.map((card) => {
          const revealed = card.matched || flipped.includes(card.id);
          return (
            <button
              key={card.id}
              type="button"
              className={[
                "memory-match__card",
                revealed ? "memory-match__card--revealed" : "",
                card.matched ? "memory-match__card--matched" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => handleFlip(card.id)}
            >
              {revealed ? card.symbol : ""}
            </button>
          );
        })}
      </div>

      {won ? (
        <>
          <p className="game-shell__status">Solved in {moves} moves 🎉</p>
          <Button type="button" onClick={newGame}>
            Play again
          </Button>
        </>
      ) : (
        <Button type="button" variant="outlined" onClick={newGame}>
          Reshuffle
        </Button>
      )}
    </div>
  );
}
