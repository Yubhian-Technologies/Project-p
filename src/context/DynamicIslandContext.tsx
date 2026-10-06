import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

export interface NowPlayingTrack {
  id: string;
  title: string;
  audioUrl: string;
}

export interface ActiveGame {
  label: string;
}

export interface IslandAlert {
  id: number;
  message: string;
}

interface DynamicIslandContextValue {
  nowPlaying: NowPlayingTrack | null;
  isPlaying: boolean;
  playMusic: (track: NowPlayingTrack) => void;
  togglePlayback: () => void;
  stopPlayback: () => void;
  activeGame: ActiveGame | null;
  setActiveGame: (game: ActiveGame | null) => void;
  alert: IslandAlert | null;
  showAlert: (message: string) => void;
}

const DynamicIslandContext = createContext<DynamicIslandContextValue | null>(null);

const ALERT_DURATION_MS = 4000;

export function DynamicIslandProvider({ children }: { children: ReactNode }) {
  const [nowPlaying, setNowPlaying] = useState<NowPlayingTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeGame, setActiveGameState] = useState<ActiveGame | null>(null);
  const [alert, setAlert] = useState<IslandAlert | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const alertTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playMusic = useCallback((track: NowPlayingTrack) => {
    setNowPlaying((prev) => {
      if (prev?.id === track.id) return prev;
      return track;
    });
    setIsPlaying(true);
  }, []);

  const togglePlayback = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    setNowPlaying(null);
  }, []);

  const setActiveGame = useCallback((game: ActiveGame | null) => {
    setActiveGameState(game);
  }, []);

  const showAlert = useCallback((message: string) => {
    if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
    setAlert({ id: Date.now(), message });
    alertTimeoutRef.current = setTimeout(() => setAlert(null), ALERT_DURATION_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
    };
  }, []);

  // Drives the single shared <audio> element so playback survives navigating
  // between dashboard sections instead of stopping each time the resource
  // panel that started it unmounts.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !nowPlaying) return;
    if (isPlaying) {
      el.play().catch(() => setIsPlaying(false));
    } else {
      el.pause();
    }
  }, [isPlaying, nowPlaying]);

  const value = useMemo<DynamicIslandContextValue>(
    () => ({
      nowPlaying,
      isPlaying,
      playMusic,
      togglePlayback,
      stopPlayback,
      activeGame,
      setActiveGame,
      alert,
      showAlert,
    }),
    [nowPlaying, isPlaying, playMusic, togglePlayback, stopPlayback, activeGame, setActiveGame, alert, showAlert],
  );

  return (
    <DynamicIslandContext.Provider value={value}>
      {children}
      {nowPlaying && (
        <audio
          ref={audioRef}
          src={nowPlaying.audioUrl}
          onEnded={stopPlayback}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
        />
      )}
    </DynamicIslandContext.Provider>
  );
}

export function useDynamicIsland(): DynamicIslandContextValue {
  const ctx = useContext(DynamicIslandContext);
  if (!ctx) throw new Error("useDynamicIsland must be used inside <DynamicIslandProvider>");
  return ctx;
}
