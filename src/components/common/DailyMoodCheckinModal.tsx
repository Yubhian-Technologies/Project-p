import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  FlameIcon,
  CheckCircleIcon,
  MoodAmazingIcon,
  MoodGoodIcon,
  MoodOkayIcon,
  MoodLowIcon,
  MoodStressedIcon,
} from "./icons";
import { useAuth } from "../../hooks/useAuth";
import { logMood, getMoodLogs, computeStreakStats, getTodayISO } from "../../services/firebase/mood";
import { completeChallenge } from "../../services/wellnessScore";
import type { MoodType } from "../../types/mood";
import "./DailyMoodCheckinModal.css";

interface DailyMoodCheckinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface MoodOptionItem {
  type: MoodType;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  promptText: string;
}

const MOOD_OPTIONS: MoodOptionItem[] = [
  {
    type: "amazing",
    label: "Amazing",
    Icon: MoodAmazingIcon,
    promptText: "Radiating positive energy! What's bringing you joy today?",
  },
  {
    type: "good",
    label: "Good",
    Icon: MoodGoodIcon,
    promptText: "Glad you are doing well! Keep this positive momentum going",
  },
  {
    type: "okay",
    label: "Okay",
    Icon: MoodOkayIcon,
    promptText: "Grounded and steady. Taking each moment as it comes",
  },
  {
    type: "low",
    label: "Low",
    Icon: MoodLowIcon,
    promptText: "We are here for you. Be gentle and patient with yourself today",
  },
  {
    type: "stressed",
    label: "Stressed",
    Icon: MoodStressedIcon,
    promptText: "Take a slow, deep breath. You don't have to carry it all alone",
  },
];

export function DailyMoodCheckinModal({ isOpen, onClose, onSuccess }: DailyMoodCheckinModalProps) {
  const { currentUser, profile } = useAuth();
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [currentStreak, setCurrentStreak] = useState<number>(0);

  // Time-aware personalized greeting
  const currentHour = new Date().getHours();
  const greetingTime = currentHour < 12 ? "Good morning" : currentHour < 17 ? "Good afternoon" : "Good evening";
  const firstName = profile?.displayName ? profile.displayName.trim().split(" ")[0] : "there";

  // Pre-fetch streak to motivate user
  useEffect(() => {
    if (!currentUser || !isOpen) return;
    let isCancelled = false;

    getMoodLogs(currentUser.uid)
      .then((logs) => {
        if (!isCancelled) {
          const stats = computeStreakStats(logs);
          setCurrentStreak(stats.currentStreak);
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [currentUser, isOpen]);

  // Handle escape key to dismiss
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        handleDismiss();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  function markDismissedToday() {
    if (currentUser) {
      const todayISO = getTodayISO();
      try {
        localStorage.setItem(`wellness_mood_popup_shown_${currentUser.uid}_${todayISO}`, "dismissed");
      } catch (e) {
        console.warn("Could not save to localStorage", e);
      }
    }
  }

  function markCompletedToday() {
    if (currentUser) {
      const todayISO = getTodayISO();
      try {
        localStorage.setItem(`wellness_mood_popup_shown_${currentUser.uid}_${todayISO}`, "logged");
      } catch (e) {
        console.warn("Could not save to localStorage", e);
      }
    }
  }

  function handleDismiss() {
    markDismissedToday();
    onClose();
  }

  async function handleSubmit() {
    if (!currentUser || !selectedMood || submitting) return;

    setSubmitting(true);
    setFeedback(null);

    try {
      await logMood(currentUser.uid, selectedMood);
      markCompletedToday();
      completeChallenge("streak");
      setIsSuccess(true);
      setCurrentStreak((prev) => prev + 1);

      if (onSuccess) {
        onSuccess();
      }

      // Auto close after brief celebration
      setTimeout(() => {
        onClose();
      }, 2200);
    } catch (err) {
      console.error("Failed to log mood in popup:", err);
      setFeedback("Couldn't save mood right now. Please try again.");
      setSubmitting(false);
    }
  }

  const selectedOpt = MOOD_OPTIONS.find((m) => m.type === selectedMood);

  return createPortal(
    <div className="daily-mood-modal__scrim" onClick={handleDismiss} role="dialog" aria-modal="true">
      <div
        className={`daily-mood-modal__card ${selectedMood ? `daily-mood-modal__card--${selectedMood}` : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="daily-mood-modal__close-btn"
          aria-label="Close"
          title="Skip for now"
          onClick={handleDismiss}
        >
          ✕
        </button>

        {!isSuccess ? (
          <>
            {/* Header */}
            <div className="daily-mood-modal__header">
              <div className="daily-mood-modal__tag">
                <span className="daily-mood-modal__flame-icon">
                  <FlameIcon />
                </span>
                <span>{currentStreak > 0 ? `${currentStreak} Day Streak!` : "Daily Mood Check-in"}</span>
              </div>

              <h2 className="daily-mood-modal__title">
                {greetingTime}, {firstName}!
              </h2>

              <p
                className={`daily-mood-modal__subtitle ${
                  selectedOpt ? "daily-mood-modal__subtitle--active" : ""
                }`}
              >
                {selectedOpt ? selectedOpt.promptText : "How are you feeling as you start your day today?"}
              </p>
            </div>

            {/* 5 Bespoke Mood Buttons */}
            <div className="daily-mood-modal__options" role="radiogroup" aria-label="Select today's mood">
              {MOOD_OPTIONS.map((item) => {
                const isSelected = selectedMood === item.type;
                const Icon = item.Icon;
                return (
                  <button
                    key={item.type}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    disabled={submitting}
                    className={`daily-mood-modal__option daily-mood-modal__option--${item.type} ${
                      isSelected ? "daily-mood-modal__option--selected" : ""
                    }`}
                    onClick={() => setSelectedMood(item.type)}
                  >
                    <div className="daily-mood-modal__option-icon-box">
                      <Icon />
                    </div>
                    <span className="daily-mood-modal__option-label">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {feedback && <div className="daily-mood-modal__feedback">{feedback}</div>}

            {/* Actions */}
            <div className="daily-mood-modal__actions">
              <button
                type="button"
                className="daily-mood-modal__submit-btn"
                disabled={!selectedMood || submitting}
                onClick={handleSubmit}
              >
                {submitting ? "Saving..." : selectedMood ? "Save Mood & Keep Streak" : "Select Your Mood"}
              </button>

              <button
                type="button"
                className="daily-mood-modal__skip-btn"
                onClick={handleDismiss}
                disabled={submitting}
              >
                Maybe later
              </button>
            </div>
          </>
        ) : (
          /* Celebratory Confirmation Screen */
          <div className="daily-mood-modal__success">
            <div className="daily-mood-modal__success-icon-wrap">
              <CheckCircleIcon />
            </div>

            <h3 className="daily-mood-modal__success-title">Mood Logged!</h3>

            <div className="daily-mood-modal__success-streak-pill">
              <FlameIcon />
              <span>{currentStreak} Day Wellness Streak Active!</span>
            </div>

            <p className="daily-mood-modal__success-msg">
              Awesome job checking in with yourself today. Have a peaceful, productive day ahead!
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
