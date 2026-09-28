import { useEffect, useRef, useState } from "react";
import { transcribeSpeech } from "../../services/huggingface/transcribe";
import {
  MicIcon,
  SquareIcon,
  HourglassIcon,
  AlertTriangleIcon,
  CheckIcon,
  FileTextIcon,
} from "../../components/common/icons";

interface VoiceToTextPanelProps {
  transcript: string;
  onTranscriptChange: (text: string) => void;
  onInsertTranscript: () => void;
  onSaveTranscript: () => Promise<void>;
}

type VoicePhase = "idle" | "recording" | "transcribing";

const supported =
  typeof window !== "undefined" &&
  typeof navigator !== "undefined" &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof window.MediaRecorder !== "undefined";

function pickMimeType(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const mime of candidates) {
    if (window.MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return undefined;
}

function formatElapsed(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function micErrorMessage(err: unknown): string {
  const name = err instanceof Error ? err.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Microphone access was denied. Allow the microphone for this site in your browser and try again.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No microphone was found. Connect one and try again.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "The microphone is busy or already in use by another app.";
  }
  if (name === "SecurityError" || name === "InsecureContextError") {
    return "Recording needs a secure (HTTPS) connection. Contact the admin if this keeps happening.";
  }
  return "Couldn't start the microphone. Check your browser permissions and try again.";
}

/**
 * Records real-time mic audio (WebM/Opus via MediaRecorder) and transcribes it
 * with the fine-tuned Whisper Space. The transcript is editable before it is
 * inserted into the report content or saved to Firestore.
 */
export function VoiceToTextPanel({
  transcript,
  onTranscriptChange,
  onInsertTranscript,
  onSaveTranscript,
}: VoiceToTextPanelProps) {
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // ── cleanup on unmount ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  async function handleStart() {
    if (!supported) {
      setError("Voice recording isn't supported in this browser. Please use a recent version of Chrome or Edge.");
      return;
    }
    setError("");
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => void handleStopped(mimeType);
      recorder.start(250);

      mediaRecorderRef.current = recorder;
      streamRef.current = stream;
      setElapsed(0);
      setPhase("recording");
      timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch (err) {
      setPhase("idle");
      setError(micErrorMessage(err));
    }
  }

  function handleStop() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }

  async function handleStopped(mimeType: string | undefined) {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
    if (blob.size === 0) {
      setPhase("idle");
      setError("No audio was captured. Check your microphone and try again.");
      return;
    }

    setPhase("transcribing");
    setError("");
    setElapsed(0);
    timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    try {
      const text = await transcribeSpeech(blob);
      setElapsed(0);
      onTranscriptChange(text);
    } catch (err) {
      console.error("Whisper transcription failed:", err);
      const detail = err instanceof Error ? err.message : String(err);
      setError(`Transcription failed — ${detail}`);
    } finally {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setPhase("idle");
    }
  }

  async function handleSave() {
    if (!transcript.trim()) return;
    setSaving(true);
    setError("");
    try {
      await onSaveTranscript();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the transcript. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const recording = phase === "recording";
  const busy = phase === "transcribing" || saving;

  return (
    <div className="wr-voice">
      <div className="wr-voice__controls">
        {recording ? (
          <button
            type="button"
            className="wr-btn wr-voice-btn wr-voice-btn--active"
            onClick={handleStop}
          >
            <SquareIcon /> Stop Recording
          </button>
        ) : (
          <button
            type="button"
            className="wr-btn wr-voice-btn"
            disabled={phase === "transcribing"}
            onClick={() => void handleStart()}
          >
            <MicIcon /> Record Audio
          </button>
        )}

        {recording && (
          <span className="wr-voice__timer">
            <span className="wr-voice__dot" />
            Recording {formatElapsed(elapsed)}
          </span>
        )}

        {phase === "transcribing" && (
          <span className="wr-voice__transcribing">
            <HourglassIcon /> Transcribing… {formatElapsed(elapsed)} elapsed
          </span>
        )}
      </div>

      {!supported && (
        <p className="wr-voice__hint">Audio recording needs Chrome or Edge on desktop.</p>
      )}

      <label className="wr-submit-card__label" htmlFor="wr-transcript">
        Transcript (editable — fix any errors before continuing)
      </label>
      <textarea
        id="wr-transcript"
        className="wr-submit-card__textarea wr-voice__transcript"
        placeholder={
          recording
            ? "Recording…"
            : "Transcript appears here after you stop recording. Feel free to edit it."
        }
        value={transcript}
        onChange={(e) => onTranscriptChange(e.target.value)}
      />

      <div className="wr-voice__actions">
        <button
          type="button"
          className="wr-btn wr-btn--view"
          disabled={!transcript.trim() || busy}
          onClick={onInsertTranscript}
        >
          <FileTextIcon /> Insert into report content
        </button>
        <button
          type="button"
          className="wr-btn wr-btn--primary"
          disabled={!transcript.trim() || busy}
          onClick={() => void handleSave()}
        >
          <CheckIcon /> {saving ? "Saving…" : "Save transcript to report"}
        </button>
      </div>

      <p className="wr-voice__hint">
        {error ? (
          <span className="wr-submit-card__error">
            <AlertTriangleIcon /> {error}
          </span>
        ) : (
          <>
            Audio is sent to the platform's speech-to-text service. Avoid dictating
            personal information.
            <br />
            Speak in full sentences for best accuracy — short single words are often
            misheard.
          </>
        )}
      </p>
    </div>
  );
}