import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { Select } from "../common/Select";
import { useAuth } from "../../hooks/useAuth";
import { useCameraCapture } from "../../hooks/useCameraCapture";
import { distanceMeters } from "../../utils/geo";
import {
  faceProfileToFloat32,
  getFaceProfile,
  type FaceProfile,
} from "../../services/firebase/faceProfiles";
import type { LivenessProgress } from "../../utils/faceVerification";
import type { CameraLocation } from "../../types/cameraLocation";
import "./CameraCheckModal.css";

interface CameraCheckModalProps {
  title: string;
  locations: CameraLocation[];
  /** Capture + validate + persist. Throws on failure. */
  onSubmit: (result: { location: CameraLocation; photoBlob: Blob }) => Promise<void>;
  onClose: () => void;
}

type FaceStep = "loading" | "ready" | "no-face" | "mismatch" | "not-registered";

/** A guided, click-to-start liveness check — not a silent background gate.
    Tapping "Capture & Confirm" walks through two short, explicit steps
    ("blink", then "turn your head") before the actual capture/match/
    geofence flow (handleSubmit) runs automatically; this proves a held-up
    photo of the registered person can't be used in place of them. See
    waitForBlink()/waitForHeadTurn() in utils/faceVerification for what
    this does and doesn't defend against. */
type LivenessPhase = "idle" | "blink" | "blink-timeout" | "move" | "move-timeout" | "verifying";

const LIVENESS_TEXT: Record<Exclude<LivenessPhase, "idle">, string> = {
  blink: "Step 1 of 2 — blink your eyes now.",
  "blink-timeout": "Didn't catch a blink — face the camera straight-on with your eyes well lit, then blink again.",
  move: "Step 2 of 2 — turn your head slightly, left or right.",
  "move-timeout": "Didn't catch a head turn — turn a little further, then try again.",
  verifying: "Verifying your face…",
};

/** Live preview from the camera with a circular face-guide overlay.
    Every capture is verified against the user's enrolled face descriptor;
    the first successful capture enrolls the face automatically. */
export function CameraCheckModal({ title, locations, onSubmit, onClose }: CameraCheckModalProps) {
  const { currentUser } = useAuth();
  const capture = useCameraCapture();
  const [locationId, setLocationId] = useState<string>(locations[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [faceStep, setFaceStep] = useState<FaceStep>("loading");
  const [faceMessage, setFaceMessage] = useState<string>("Loading face model…");
  const [profile, setProfile] = useState<FaceProfile | null>(null);
  const [livenessPhase, setLivenessPhase] = useState<LivenessPhase>("idle");
  const [progress, setProgress] = useState<LivenessProgress | null>(null);
  const livenessSignalRef = useRef({ cancelled: false });

  const selected = useMemo(
    () => locations.find((l) => l.id === locationId) ?? null,
    [locationId, locations],
  );

  // Load the recognition model and this user's enrolled profile up-front so
  // the Capture button only lights up when verification is possible.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [existing, faceModule] = await Promise.all([
          currentUser ? getFaceProfile(currentUser.uid) : Promise.resolve(null),
          import("../../utils/faceVerification"),
        ]);
        await faceModule.loadFaceModels();
        if (cancelled) return;
        setProfile(existing);
        if (existing) {
          setFaceStep("ready");
          // Overridden by the liveness instructions below once the camera
          // itself is live — this only ever shows before "Start Camera".
          setFaceMessage("Press \"Start Camera\" to begin.");
        } else {
          setFaceStep("not-registered");
          setFaceMessage("You haven't registered your face yet — close this and use \"Register Face\" first.");
        }
      } catch {
        if (!cancelled) {
          setFaceStep("no-face");
          setFaceMessage("Couldn't load the face model. Check your connection and reopen.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid]);

  // Stops any in-flight blink/head-turn wait loop when the modal unmounts,
  // so it doesn't keep polling a video element that's gone.
  useEffect(() => {
    return () => {
      livenessSignalRef.current.cancelled = true;
    };
  }, []);

  /** Runs when "Capture & Confirm" is tapped (or "Try Again" after a
      timeout): walks through the two liveness steps in order, each with
      its own short timeout and a clear instruction on screen, then runs
      the real capture/match/geofence flow automatically — no extra click
      needed once both steps are seen. */
  async function startLivenessThenCapture() {
    const video = capture.videoRef.current;
    if (!video) {
      setError("Camera not ready — press Start Camera first.");
      return;
    }
    setError(null);
    const signal = { cancelled: false };
    livenessSignalRef.current = signal;
    const { waitForBlink, waitForHeadTurn } = await import("../../utils/faceVerification");

    setLivenessPhase("blink");
    setProgress(null);
    const blinked = await waitForBlink(video, signal, 10000, (p) => setProgress(p));
    if (signal.cancelled) return;
    if (!blinked) {
      setLivenessPhase("blink-timeout");
      return;
    }

    setLivenessPhase("move");
    setProgress(null);
    const turned = await waitForHeadTurn(video, signal, 10000, (p) => setProgress(p));
    if (signal.cancelled) return;
    if (!turned) {
      setLivenessPhase("move-timeout");
      return;
    }

    setLivenessPhase("verifying");
    setProgress(null);
    await handleSubmit();
    if (!signal.cancelled) setLivenessPhase("idle");
  }

  async function handleSubmit() {
    if (!selected || !currentUser) return;
    setBusy(true);
    setError(null);
    try {
      // 1. Face detection + descriptor from the live frame.
      const video = capture.videoRef.current;
      if (!video) {
        setError("Camera not ready — press Start Camera first.");
        return;
      }
      const descriptor = await (await import("../../utils/faceVerification")).describeFaceFromVideo(video);
      if (!descriptor) {
        setFaceStep("no-face");
        setFaceMessage("No face detected — center your face in the circle with good lighting.");
        return;
      }

      // 2. Verify against the enrolled descriptor — registration is a
      // separate, explicit step (see FaceRegisterModal) that must already
      // be done; this modal never enrolls a face itself.
      if (!profile) {
        setFaceStep("not-registered");
        setFaceMessage("You haven't registered your face yet — close this and use \"Register Face\" first.");
        return;
      }
      const { descriptorDistance, FACE_MATCH_THRESHOLD } = await import("../../utils/faceVerification");
      const faceDist = descriptorDistance(descriptor, faceProfileToFloat32(profile));
      if (faceDist >= FACE_MATCH_THRESHOLD) {
        setFaceStep("mismatch");
        setFaceMessage(
          `Face didn't match your enrolled face (difference ${faceDist.toFixed(2)} > ${FACE_MATCH_THRESHOLD}). Make sure it's you, with even lighting; if your appearance changed a lot, ask your Head to reset your registration.`,
        );
        return;
      }
      setFaceStep("ready");

      // 3. Capture the photo + geolocation fix.
      const result = await capture.capture();
      if (!result) {
        setError(capture.error ?? "Capture failed. Please try again.");
        return;
      }

      // 4. Geofence check against the selected camera location.
      const dist = distanceMeters(
        result.latitude,
        result.longitude,
        selected.latitude,
        selected.longitude,
      );
      if (dist > selected.radiusMeters) {
        setError(
          `You are ${Math.round(dist)}m from "${selected.name}" — outside its ${selected.radiusMeters}m range. ` +
            `Your device reported ${result.latitude.toFixed(5)}, ${result.longitude.toFixed(5)}; the camera location ` +
            `is set at ${selected.latitude.toFixed(5)}, ${selected.longitude.toFixed(5)}. If that first pair isn't ` +
            `near where you actually are, it's your device/browser's location reading that's off, not the camera ` +
            `location's setup — common on desktop browsers without GPS. Move to the camera location and try again.`,
        );
        return;
      }

      // 5. Persist.
      await onSubmit({ location: selected, photoBlob: result.photoBlob });
      capture.close();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const statusMessage = livenessPhase === "idle" ? faceMessage : LIVENESS_TEXT[livenessPhase];
  const statusWarn =
    livenessPhase === "blink-timeout" || livenessPhase === "move-timeout"
      ? true
      : livenessPhase !== "idle"
        ? false
        : faceStep === "mismatch" || faceStep === "no-face" || faceStep === "not-registered";
  const livenessRunning = livenessPhase === "blink" || livenessPhase === "move" || livenessPhase === "verifying";
  const timedOut = livenessPhase === "blink-timeout" || livenessPhase === "move-timeout";

  return (
    <Modal title={title} onClose={() => { capture.close(); onClose(); }}>
      <div className="camera-check">
        {locations.length === 0 ? (
          <p className="camera-check__empty">
            No camera locations are set up for you yet. Ask your Head or Admin to set your Location 1 and Location 2.
          </p>
        ) : (
          <>
            <div className="camera-check__field">
              <label htmlFor="camera-check-location">Camera Location</label>
              <Select
                id="camera-check-location"
                value={locationId}
                onChange={setLocationId}
                disabled={busy}
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </Select>
            </div>
            {selected?.description && (
              <p className="camera-check__hint">{selected.description}</p>
            )}

            <div className="camera-check__viewport">
              <video ref={capture.videoRef} playsInline muted autoPlay />
              <div className="camera-check__guide" aria-hidden="true" />
              {capture.phase === "loading" && (
                <div className="camera-check__overlay">Starting camera…</div>
              )}
              {(livenessPhase === "blink" || livenessPhase === "move") && progress && (
                <div
                  className={`camera-check__analyzing${progress.hint === "analyzing" ? "" : " camera-check__analyzing--noface"}`}
                  role="status"
                >
                  <span className="camera-check__analyzing-dot" aria-hidden="true" />
                  {progress.hint === "analyzing"
                    ? "Analyzing…"
                    : progress.hint === "too-far"
                      ? "You're too far — move closer"
                      : "Your face is not visible — look at the camera"}
                </div>
              )}
            </div>

            <p
              className={`camera-check__face-status${statusWarn ? " camera-check__face-status--warn" : ""}`}
            >
              {statusWarn ? "⚠ " : "✓ "}
              {statusMessage}
            </p>

            {capture.error && <p className="camera-check__error">{capture.error}</p>}
            {error && <p className="camera-check__error">{error}</p>}

            <div className="camera-check__actions">
              {capture.phase !== "ready" && capture.phase !== "done" && (
                <Button type="button" variant="outlined" onClick={capture.open} disabled={busy}>
                  Start Camera
                </Button>
              )}
              <Button
                type="button"
                onClick={startLivenessThenCapture}
                disabled={busy || livenessRunning || capture.phase !== "ready" || faceStep !== "ready"}
              >
                {timedOut
                  ? "Try Again"
                  : livenessPhase === "blink"
                    ? "Blink your eyes…"
                    : livenessPhase === "move"
                      ? "Turn your head…"
                      : busy || livenessPhase === "verifying"
                        ? "Verifying & saving…"
                        : "Capture & Confirm"}
              </Button>
            </div>
            <p className="camera-check__note">
              Tap "Capture & Confirm", then follow the two quick prompts (blink, then turn your head) —
              your face is matched against your enrolled face and your current location is checked
              against the camera location's range before this check is accepted.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
