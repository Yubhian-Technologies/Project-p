import { AnimatePresence, motion } from "framer-motion";
import { useDynamicIsland } from "../../context/DynamicIslandContext";
import { MusicIcon, SparklesIcon, BellIcon, PauseIcon, PlayIcon, XIcon } from "./icons";
import "./DynamicIsland.css";

const SPRING = { type: "spring" as const, duration: 0.5, bounce: 0.25 };

export function DynamicIsland() {
  const { nowPlaying, isPlaying, togglePlayback, stopPlayback, activeGame, alert } = useDynamicIsland();

  // Priority: a fresh alert briefly takes over, then now-playing music, then
  // an active game session. Nothing shows at all when none apply — an always
  // -visible empty pill would just be clutter on pages with nothing going on.
  const view = alert ? "alert" : nowPlaying ? "music" : activeGame ? "game" : null;

  return (
    <div className="dyn-island-wrap" aria-live="polite">
      <AnimatePresence>
        {view && (
          <motion.div
            layout
            className={`dyn-island dyn-island--${view}`}
            initial={{ opacity: 0, scale: 0.85, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: -10 }}
            transition={SPRING}
          >
            {view === "alert" && alert && (
              <div className="dyn-island__row">
                <BellIcon className="dyn-island__icon" />
                <span className="dyn-island__text">{alert.message}</span>
              </div>
            )}

            {view === "music" && nowPlaying && (
              <div className="dyn-island__row">
                <MusicIcon className="dyn-island__icon" />
                <span className="dyn-island__text">{nowPlaying.title}</span>
                <button
                  type="button"
                  className="dyn-island__btn"
                  aria-label={isPlaying ? "Pause" : "Play"}
                  onClick={togglePlayback}
                >
                  {isPlaying ? <PauseIcon /> : <PlayIcon />}
                </button>
                <button
                  type="button"
                  className="dyn-island__btn"
                  aria-label="Stop"
                  onClick={stopPlayback}
                >
                  <XIcon />
                </button>
              </div>
            )}

            {view === "game" && activeGame && (
              <div className="dyn-island__row">
                <SparklesIcon className="dyn-island__icon dyn-island__icon--pulse" />
                <span className="dyn-island__text">{activeGame.label}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
