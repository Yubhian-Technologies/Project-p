import { useCallback, useEffect, useRef, useState } from "react";

/**
 * State machine for capturing a face photo in the browser.
 * Phases: idle → loading (camera permission) → ready → capturing (geolocation) → done | error
 */
export interface CameraCaptureState {
  phase: "idle" | "loading" | "ready" | "capturing" | "done" | "error";
  error: string | null;
}

interface CameraCaptureResult {
  photoBlob: Blob;
  latitude: number;
  longitude: number;
}

interface CameraCaptureApi extends CameraCaptureState {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  open: () => void;
  close: () => void;
  capture: () => Promise<CameraCaptureResult | null>;
}

/**
 * Loads the device camera into a <video> element, then takes a still frame
 * and a geolocation fix. The video element should be rendered as soon as
 * `open()` is called so getUserMedia can attach to it.
 */
export function useCameraCapture(): CameraCaptureApi {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<CameraCaptureState["phase"]>("idle");
  const [error, setError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const open = useCallback(() => {
    setError(null);
    setPhase("loading");
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
        setPhase("ready");
      })
      .catch(() => {
        setError("Camera access denied or unavailable. Allow camera access and try again.");
        setPhase("error");
      });
  }, []);

  const close = useCallback(() => {
    stopStream();
    setError(null);
    setPhase("idle");
  }, []);

  useEffect(() => stopStream, [stopStream]);

  const capture = useCallback(async (): Promise<CameraCaptureResult | null> => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setError("Camera not ready. Please wait a moment and try again.");
      return null;
    }
    setPhase("capturing");
    try {
      // Draw the current frame onto a canvas to get a jpeg blob.
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = Math.min(video.videoWidth, video.videoHeight);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable.");
      const side = Math.min(video.videoWidth, video.videoHeight);
      // Center-crop to a square so the capture frames the face.
      ctx.drawImage(
        video,
        (video.videoWidth - side) / 2,
        (video.videoHeight - side) / 2,
        side,
        side,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const photoBlob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode image."))),
          "image/jpeg",
          0.85,
        ),
      );

      // Geolocation fix for the camera's physical location.
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation?.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });

      setPhase("done");
      return {
        photoBlob,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not capture location or image.");
      setPhase("error");
      return null;
    }
  }, []);

  return { phase, error, videoRef, open, close, capture };
}
