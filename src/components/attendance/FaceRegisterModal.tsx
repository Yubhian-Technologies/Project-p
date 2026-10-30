import { useEffect, useState } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { useCameraCapture } from "../../hooks/useCameraCapture";
import { enrollFaceProfile } from "../../services/firebase/faceProfiles";
import "./CameraCheckModal.css";

interface FaceRegisterModalProps {
  uid: string;
  campusId: string;
  onDone: () => void;
  onClose: () => void;
}

/** One-time face registration: capture a live frame, extract its descriptor,
    and save it as this user's enrolled face. No location/geofence check —
    those only apply to check-in/out, which require this to be done first.
    firestore.rules reject a second registration outright, so this is only
    ever reachable while the person has no profile yet (first time, or after
    their Head/admin manager has reset it). */
export function FaceRegisterModal({ uid, campusId, onDone, onClose }: FaceRegisterModalProps) {
  const capture = useCameraCapture();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import("../../utils/faceVerification").then(async (m) => {
      await m.loadFaceModels();
      if (!cancelled) setModelReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCapture() {
    const video = capture.videoRef.current;
    if (!video) {
      setError("Camera not ready — press Start Camera first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { describeFaceFromVideo } = await import("../../utils/faceVerification");
      const descriptor = await describeFaceFromVideo(video);
      if (!descriptor) {
        setError("No face detected — center your face in the circle with good lighting and try again.");
        return;
      }
      await enrollFaceProfile(uid, campusId, descriptor);
      capture.close();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Register Your Face" onClose={() => { capture.close(); onClose(); }}>
      <div className="camera-check">
        <p className="camera-check__hint">
          This is a one-time setup — it only takes a second. Center your face in the circle with even lighting; this
          becomes the face every future check-in and check-out is matched against. If you ever need to re-register
          (big appearance change, lighting issues, etc.), ask your Head to reset it for you.
        </p>

        <div className="camera-check__viewport">
          <video ref={capture.videoRef} playsInline muted autoPlay />
          <div className="camera-check__guide" aria-hidden="true" />
          {capture.phase === "loading" && <div className="camera-check__overlay">Starting camera…</div>}
        </div>

        {capture.error && <p className="camera-check__error">{capture.error}</p>}
        {error && <p className="camera-check__error">{error}</p>}

        <div className="camera-check__actions">
          {capture.phase !== "ready" && capture.phase !== "done" && (
            <Button type="button" variant="outlined" onClick={capture.open} disabled={busy}>
              Start Camera
            </Button>
          )}
          <Button type="button" onClick={handleCapture} disabled={busy || capture.phase !== "ready" || !modelReady}>
            {busy ? "Registering…" : "Capture & Register"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
