import * as faceapi from "@vladmandic/face-api";

/**
 * Face verification for camera check-in / check-out.
 *
 * A 128-number face descriptor is computed from the live capture and compared
 * with the one enrolled for the user (stored in Firestore on first check-in).
 * A euclidean distance below FACE_MATCH_THRESHOLD means it's the same person.
 */

const MODEL_URL =
  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model/";

// Human face descriptors differ by roughly 0.4–0.6 for different people;
// 0.5 is the commonly used compromise between false accepts and rejects.
export const FACE_MATCH_THRESHOLD = 0.5;

let modelsLoaded: Promise<void> | null = null;

/** Loads the tiny face detector + landmark + descriptor networks once. */
export function loadFaceModels(): Promise<void> {
  if (!modelsLoaded) {
    modelsLoaded = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]).then(() => undefined);
  }
  return modelsLoaded;
}

/**
 * Detects the single face in a video element and returns its descriptor.
 * Returns null if no face (or more than one) is confidently found.
 */
export async function describeFaceFromVideo(
  video: HTMLVideoElement,
): Promise<Float32Array | null> {
  await loadFaceModels();
  const result = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  return result?.descriptor ?? null;
}

export interface LivenessSample {
  /** Average eye-aspect-ratio across both eyes this frame — dips sharply,
      briefly, during a real blink. */
  earAvg: number;
  /** Nose-tip position in video pixel coordinates, for detecting that the
      head has actually turned in 3D (a flat photo can't do this the way a
      real face can). */
  nose: { x: number; y: number };
  faceBox: { width: number; height: number };
}

function pointDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Standard eye-aspect-ratio (Soukupová & Čech) from the 6 eye-contour
    points face-api.js returns (outer corner, two upper lid points, inner
    corner, two lower lid points) — stays roughly constant for an open eye
    and drops sharply for a closed one. */
function eyeAspectRatio(eye: { x: number; y: number }[]): number {
  const vertical1 = pointDistance(eye[1], eye[5]);
  const vertical2 = pointDistance(eye[2], eye[4]);
  const horizontal = pointDistance(eye[0], eye[3]);
  if (horizontal === 0) return 1;
  return (vertical1 + vertical2) / (2 * horizontal);
}

/**
 * One frame's liveness signals — "liveness-lite", not certified anti-spoof:
 * it's a real, meaningful check (a static printed photo or phone screenshot
 * literally cannot blink or turn in 3D, so holding one up to the camera no
 * longer passes), using only the face-landmark model already loaded for
 * matching — no extra model, no extra network request. It does NOT defend
 * against a more sophisticated attack like a video replay of the registered
 * person blinking; that's a deliberate scope choice for an attendance
 * system, not a security-critical access gate.
 */
export async function sampleLiveness(video: HTMLVideoElement): Promise<LivenessSample | null> {
  // Lighter detector settings than face matching uses: each inference is
  // several times faster, which matters here — a real blink lasts only
  // ~100–300ms, so slow detection simply never sees the closed-eye frames.
  const result = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.4 }))
    .withFaceLandmarks();
  if (!result) return null;
  const leftEye = result.landmarks.getLeftEye();
  const rightEye = result.landmarks.getRightEye();
  const nose = result.landmarks.getNose();
  const noseTip = nose[Math.floor(nose.length / 2)];
  return {
    earAvg: (eyeAspectRatio(leftEye) + eyeAspectRatio(rightEye)) / 2,
    nose: { x: noseTip.x, y: noseTip.y },
    faceBox: { width: result.detection.box.width, height: result.detection.box.height },
  };
}

/** Lets an in-flight wait* loop below be stopped early (closing the modal,
    starting over) without leaving a dangling setTimeout chain. */
export interface LivenessSignal {
  cancelled: boolean;
}

/**
 * Waits for an explicit blink, sampling quickly (every ~90ms) so the brief
 * closed-eye frame isn't skipped over the way a slower poll could miss it.
 * Rather than a fixed "open"/"closed" eye-aspect-ratio threshold — which
 * failed for some people entirely, since a person's own natural open-eye
 * ratio can sit below a one-size-fits-all cutoff — this calibrates to the
 * person's own eyes: it tracks the highest ratio seen so far (their eyes
 * open) and fires when a later sample dips to a modest fraction of that
 * peak, OR below an absolute "clearly closed" cutoff as a fallback for
 * naturally narrow-eyed people whose peak under-states their open-eye
 * ratio. A single-frame detection jitter can't fake a dip (landmarks move
 * smoothly between frames), so firing on the first qualifying frame keeps
 * blinks that last only 2–3 samples from being missed. Resolves true the
 * instant a blink is seen, false on timeout.
 */
/** How far the face is from the camera, judged by its detected box relative
    to the video frame — the same "am I framed correctly" cue a face-guide
    circle gives. Too small a box = step closer. */
export interface LivenessProgress {
  /** What the person should be told right now, updated every frame. */
  hint: "analyzing" | "too-far" | "no-face";
  /** True when a face is currently tracked AND large enough to analyze —
      "analyzing" is only ever shown when this is true. */
  faceSeen: boolean;
  /** Milliseconds elapsed in this step, for a live elapsed read. */
  elapsedMs: number;
}

/** Face-box width (fraction of the video width) below which the face is
    considered too far from the camera for reliable blink/head tracking. */
const MIN_FACE_FRACTION = 0.22;

function classifyProgress(
  sample: LivenessSample | null,
  video: HTMLVideoElement,
  elapsedMs: number,
): LivenessProgress {
  if (!sample) {
    return { hint: "no-face", faceSeen: false, elapsedMs };
  }
  const width = video.videoWidth || 1;
  if (sample.faceBox.width < width * MIN_FACE_FRACTION) {
    return { hint: "too-far", faceSeen: false, elapsedMs };
  }
  return { hint: "analyzing", faceSeen: true, elapsedMs };
}

export async function waitForBlink(
  video: HTMLVideoElement,
  signal: LivenessSignal,
  timeoutMs = 10000,
  onProgress?: (progress: LivenessProgress) => void,
): Promise<boolean> {
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  let peakEar = 0;
  while (Date.now() < deadline) {
    if (signal.cancelled) return false;
    const sample = await sampleLiveness(video);
    if (sample) {
      const relativeDip = peakEar > 0.1 && sample.earAvg < peakEar * 0.8;
      const absoluteClosed = peakEar < 0.25 && sample.earAvg < 0.2;
      if (relativeDip || absoluteClosed) return true;
      if (sample.earAvg > peakEar) peakEar = sample.earAvg;
    }
    onProgress?.(classifyProgress(sample, video, Date.now() - startedAt));
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  return false;
}

/** Waits for a small, deliberate head turn — the nose tip moving further
    than a few percent of the detected face's own width from where it first
    settled, held for two consecutive samples so a single landmark-jitter
    frame can't pass the check. The baseline also re-anchors to the closest
    sample seen, so drift that happens before the person starts turning
    doesn't leave them with an unreachable distance. Resolves true the
    instant it's seen, false on timeout. */
export async function waitForHeadTurn(
  video: HTMLVideoElement,
  signal: LivenessSignal,
  timeoutMs = 10000,
  onProgress?: (progress: LivenessProgress) => void,
): Promise<boolean> {
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  let baseline: { x: number; y: number } | null = null;
  let consecutive = 0;
  while (Date.now() < deadline) {
    if (signal.cancelled) return false;
    const sample = await sampleLiveness(video);
    if (sample) {
      if (!baseline) {
        baseline = sample.nose;
      } else {
        const moved = pointDistance(sample.nose, baseline) > sample.faceBox.width * 0.06;
        if (moved) {
          consecutive += 1;
          if (consecutive >= 2) return true;
        } else {
          consecutive = 0;
          // Re-anchor only while the face is still — never after movement
          // has begun, or the target would keep moving away.
          if (pointDistance(sample.nose, baseline) < sample.faceBox.width * 0.02) {
            baseline = sample.nose;
          }
        }
      }
    }
    onProgress?.(classifyProgress(sample, video, Date.now() - startedAt));
    await new Promise((resolve) => setTimeout(resolve, 90));
  }
  return false;
}

/** Euclidean distance between two face descriptors. */
export function descriptorDistance(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

/** True when the two descriptors belong to the same person. */
export function descriptorsMatch(a: Float32Array, b: Float32Array): boolean {
  return descriptorDistance(a, b) < FACE_MATCH_THRESHOLD;
}
