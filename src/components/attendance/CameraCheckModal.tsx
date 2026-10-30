import { useEffect, useMemo, useState } from "react";
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
          setFaceMessage("Face model loaded — you're registered. Look at the camera and capture.");
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
            </div>

            <p
              className={`camera-check__face-status${
                faceStep === "mismatch" || faceStep === "no-face" || faceStep === "not-registered"
                  ? " camera-check__face-status--warn"
                  : ""
              }`}
            >
              {faceStep === "mismatch" || faceStep === "no-face" || faceStep === "not-registered" ? "⚠ " : "✓ "}
              {faceMessage}
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
                onClick={handleSubmit}
                disabled={busy || capture.phase !== "ready" || faceStep !== "ready"}
              >
                {busy ? "Verifying & saving…" : "Capture & Confirm"}
              </Button>
            </div>
            <p className="camera-check__note">
              Your face is matched against your enrolled face and your current location is
              checked against the camera location's range before this check is accepted.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
