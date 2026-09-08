import { useEffect, useState } from "react";
import { Button } from "../../../components/common/Button";
import { useBestScore } from "../../../hooks/useBestScore";
import "./TicTacToeGame.css";

type Cell = "X" | "O" | null;

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function winnerOf(board: Cell[]): Cell {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

function computerMove(board: Cell[]): number {
  const empty = board.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0);

  for (const i of empty) {
    const next = [...board];
    next[i] = "O";
    if (winnerOf(next) === "O") return i;
  }
  for (const i of empty) {
    const next = [...board];
    next[i] = "X";
    if (winnerOf(next) === "X") return i;
  }
  if (board[4] === null) return 4;
  const corners = [0, 2, 6, 8].filter((i) => board[i] === null);
  if (corners.length > 0) return corners[Math.floor(Math.random() * corners.length)];
  return empty[Math.floor(Math.random() * empty.length)];
}

export function TicTacToeGame() {
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
  const [streak, setStreak] = useState(0);
  const { best, submit } = useBestScore("tic-tac-toe", "higher");

  const winner = winnerOf(board);
  const isDraw = !winner && board.every((c) => c !== null);
  const playerTurn = !winner && !isDraw && board.filter((c) => c).length % 2 === 0;

  useEffect(() => {
    if (winner === "X") {
      setStreak((s) => {
        const next = s + 1;
        submit(next);
        return next;
      });
    } else if (winner === "O") {
      setStreak(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner]);

  useEffect(() => {
    if (playerTurn || winner || isDraw) return;
    const move = setTimeout(() => {
      setBoard((b) => {
        const next = [...b];
        next[computerMove(b)] = "O";
        return next;
      });
    }, 450);
    return () => clearTimeout(move);
  }, [board, playerTurn, winner, isDraw]);

  function handleCell(index: number) {
    if (!playerTurn || board[index]) return;
    const next = [...board];
    next[index] = "X";
    setBoard(next);
  }

  function newGame() {
    setBoard(Array(9).fill(null));
  }

  let status = "Your move (X)";
  if (winner === "X") status = "You win! 🎉";
  else if (winner === "O") status = "The computer wins this round.";
  else if (isDraw) status = "It's a draw.";
  else if (!playerTurn) status = "Computer is thinking…";

  return (
    <div className="game-shell">
      <h2 className="game-shell__title">Tic-Tac-Toe</h2>
      <div className="game-shell__stats">
        <div className="game-shell__stat">
          <span className="game-shell__stat-value">{streak}</span>
          <span className="game-shell__stat-label">Streak</span>
        </div>
        <div className="game-shell__stat">
          <span className="game-shell__stat-value">{best ?? "—"}</span>
          <span className="game-shell__stat-label">Best streak</span>
        </div>
      </div>

      <p className="game-shell__status">{status}</p>

      <div className="ttt__grid">
        {board.map((cell, i) => (
          <button
            key={i}
            type="button"
            className="ttt__cell"
            disabled={!playerTurn || !!cell}
            onClick={() => handleCell(i)}
          >
            {cell}
          </button>
        ))}
      </div>

      <Button type="button" variant="outlined" onClick={newGame}>
        New game
      </Button>
    </div>
  );
}
