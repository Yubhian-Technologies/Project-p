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
