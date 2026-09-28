import { Client } from "@gradio/client";

/**
 * Speech-to-text for the counsellor Work Reports section.
 *
 * The Whisper model is served by a public Hugging Face Gradio Space
 * (https://udaysanjay-whisper-lora-stt.hf.space). The @gradio/client package is
 * used to connect and call its /transcribe endpoint with the recorded audio
 * blob; the plain-text transcript is returned as result.data[0].
 *
 * A/B testing (stock whisper-small vs the fine-tuned LoRA vs whisper-large-v3-
 * turbo) showed the fine-tuned LoRA HALLUCINATES and is less accurate, so the
 * client pins the stock whisper-small preset ("stock-small") explicitly rather
 * than relying on the Space's default.
 *
 * PRIVACY NOTE: this Space is PUBLIC, so the uploaded audio is sent to a
 * third-party server. Do not upload identifiable personal audio in production.
 * When a self-hosted endpoint is available, swap transcribeSpeech() to call it
 * and keep returning a trimmed string — nothing else in the UI needs to change.
 */

const WHISPER_SPACE_URL = "https://udaysanjay-whisper-lora-stt.hf.space/";

/** Model preset requested from the Space. See MODEL_PRESETS in its app.py. */
const MODEL_PRESET = "stock-small";

/**
 * Endpoint names we accept. Newer Gradio apps name the function explicitly
 * (here: /transcribe); classic apps use the generic "/predict" name (api_map
 * key "predict") and the previous app deployed this Space's fn as
 * "run_transcription". We resolve against the live app config so any of them
 * works.
 */
const ENDPOINT_CANDIDATES = ["transcribe", "predict", "run_transcription"];

let clientPromise: Promise<Client> | null = null;

function getWhisperClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = Client.connect(WHISPER_SPACE_URL);
  }
  return clientPromise;
}

function resolveEndpoint(client: Client): string {
  const apiMap = client.api_map ?? {};
  const endpoint = ENDPOINT_CANDIDATES.find((name) => apiMap[name] != null);
  if (!endpoint) {
    throw new Error(
      "The transcription service didn't respond with a known endpoint. Please try again or tell the admin the Whisper Space API changed.",
    );
  }
  return endpoint;
}

// ── audio conversion ─────────────────────────────────────────────────
// MediaRecorder produces WebM/Opus, but the Gradio audio pipeline (libsndfile)
// can't decode WebM — uploads fail with "LibsndfileError". Whisper's ideal
// input is 16 kHz mono WAV. Decode + resample client-side via the Web Audio
// API before uploading so any supported mic format works.

const TARGET_SAMPLE_RATE = 16000;

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err ?? err);
}

function writeAscii(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function encodePcm16Wav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample; // mono
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // 16-bit
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += bytesPerSample;
  }
  return buffer;
}

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor {
  const maybeWebkit = (window as unknown as {
    webkitAudioContext?: AudioContextCtor;
  }).webkitAudioContext;
  return window.AudioContext ?? maybeWebkit;
}

// ── silence trim ──────────────────────────────────────────────────────
// Leading/trailing silence is one of Whisper's main hallucination triggers
// (it "imagines" speech in quiet audio) and it also wastes inference time.
// We drop quiet edges and keep a small margin so words are never clipped.

const SILENCE_RMS_THRESHOLD = 0.01;
const SILENCE_FRAME_MS = 20;
const SILENCE_MARGIN_S = 0.15;

function trimSilence(samples: Float32Array, sampleRate: number): Float32Array {
  const frameSize = Math.max(1, Math.floor((sampleRate * SILENCE_FRAME_MS) / 1000));
  const frameCount = Math.floor(samples.length / frameSize);
  if (frameCount < 3) return samples;

  let firstSpeechFrame = -1;
  let lastSpeechFrame = -1;
  for (let frame = 0; frame < frameCount; frame++) {
    const start = frame * frameSize;
    let sumSquares = 0;
    for (let i = 0; i < frameSize; i++) {
      const s = samples[start + i];
      sumSquares += s * s;
    }
    const rms = Math.sqrt(sumSquares / frameSize);
    if (rms >= SILENCE_RMS_THRESHOLD) {
      if (firstSpeechFrame === -1) firstSpeechFrame = frame;
      lastSpeechFrame = frame;
    }
  }

  if (firstSpeechFrame === -1 || lastSpeechFrame === -1) return samples;

  const margin = Math.floor(sampleRate * SILENCE_MARGIN_S);
  const start = Math.max(0, firstSpeechFrame * frameSize - margin);
  const end = Math.min(samples.length, (lastSpeechFrame + 1) * frameSize + margin);
  return samples.slice(start, end);
}

/** Decodes any browser-supported audio blob and returns 16 kHz mono WAV. */
async function to16kMonoWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();

  const AudioCtx = getAudioContextCtor();
  const decodeCtx = new AudioCtx();
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
  } catch (err) {
    throw new Error(`couldn't decode the recording — ${errorText(err)}`);
  } finally {
    void decodeCtx.close();
  }

  const frameCount = Math.max(1, Math.ceil(audioBuffer.duration * TARGET_SAMPLE_RATE));
  let rendered: AudioBuffer;
  try {
    const offline = new OfflineAudioContext(1, frameCount, TARGET_SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offline.destination);
    source.start(0);
    rendered = await offline.startRendering();
  } catch (err) {
    throw new Error(`couldn't resample the recording — ${errorText(err)}`);
  }
  const wavBytes = encodePcm16Wav(
    trimSilence(rendered.getChannelData(0), TARGET_SAMPLE_RATE),
    TARGET_SAMPLE_RATE,
  );
  return new Blob([wavBytes], { type: "audio/wav" });
}

/** Sends a recorded audio blob to the Whisper Space and returns the text. */
export async function transcribeSpeech(blob: Blob): Promise<string> {
  let client: Client;
  try {
    client = await getWhisperClient();
  } catch (err) {
    throw new Error(`couldn't reach the speech service — ${errorText(err)}`);
  }

  const endpoint = resolveEndpoint(client);

  let wavBlob: Blob;
  try {
    wavBlob = await to16kMonoWav(blob);
  } catch (err) {
    throw new Error(
      `couldn't prepare the recording — ${errorText(err)}. If this keeps happening, try a different browser.`,
    );
  }

  const file: File = new File(
    [wavBlob],
    `work-report-recording-${Date.now()}.wav`,
    { type: "audio/wav" },
  );

  let result: { data: unknown[] } | undefined;
  try {
    result = (await client.predict<unknown>(endpoint, [file, MODEL_PRESET])) as unknown as {
      data: unknown[];
    };
  } catch (err) {
    throw new Error(`the speech service rejected the audio — ${errorText(err)}`);
  }

  const text = (result?.data as unknown[])?.[0];
  if (typeof text !== "string") {
    throw new Error("The transcription service returned an unexpected response.");
  }
  return text.trim();
}