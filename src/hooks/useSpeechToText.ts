import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechResultLike {
  isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechAlternativeLike;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { results: ArrayLike<SpeechResultLike> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

function getRecognitionCtor():
  | (new () => SpeechRecognitionLike)
  | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Some browsers (notably Chrome on Android) report cumulative results: each
 * new result restates everything said before it. Naively concatenating them
 * yields "hi hi hello hello", so a segment that already contains the text
 * so far replaces it, and one already contained in it is dropped.
 */
function mergeSegment(acc: string, segment: string): string {
  if (!acc) return segment;
  const a = acc.toLowerCase();
  const s = segment.toLowerCase();
  if (s.startsWith(a)) return segment;
  if (a.endsWith(s)) return acc;
  return `${acc} ${segment}`;
}

/**
 * Browser-native speech-to-text (Web Speech API — the same engine behind
 * Gemini/Chrome voice search). No API keys, no backend, no user audio ever
 * touched by us. Live interim words stream through `onTranscript` while
 * speaking; everything is committed when the session ends.
 */
export function useSpeechToText(onTranscript: (text: string) => void) {
  const [supported] = useState(() => !!getRecognitionCtor());
  const [listening, setListening] = useState(false);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");
  const interimRef = useRef("");
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const commit = useCallback((includeInterim: boolean) => {
    const final = finalRef.current.trim();
    const interim = interimRef.current.trim();
    const text = [final, includeInterim ? interim : ""].filter(Boolean).join(" ");
    if (text) {
      onTranscriptRef.current(text);
    }
    finalRef.current = "";
    interimRef.current = "";
  }, []);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    try {
      rec.stop();
    } catch {
      // already stopped
    }
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    finalRef.current = "";
    interimRef.current = "";

    rec.onresult = (event) => {
      let final = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const res = event.results[i];
        const transcript = (res[0]?.transcript ?? "").trim();
        if (!transcript) continue;
        if (res.isFinal) final = mergeSegment(final, transcript);
        else interim = mergeSegment(interim, transcript);
      }
      // Interim text can restate the tail of what is already final — don't repeat it.
      interim = mergeSegment(final, interim).slice(final.length).trim();
      finalRef.current = final;
      interimRef.current = interim;
      onTranscriptRef.current([final, interim].filter(Boolean).join(" "));
    };

    rec.onend = () => {
      recRef.current = null;
      setListening(false);
      commit(true);
    };

    rec.onerror = () => {
      recRef.current = null;
      setListening(false);
      commit(true);
    };

    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      recRef.current = null;
      setListening(false);
    }
  }, [commit]);

  const toggle = useCallback(() => {
    if (recRef.current) {
      stop();
    } else {
      start();
    }
  }, [start, stop]);

  useEffect(
    () => () => {
      try {
        recRef.current?.abort();
      } catch {
        // ignore
      }
    },
    [],
  );

  return { supported, listening, start, stop, toggle } as const;
}