"use client";

import { useRef, useState, useSyncExternalStore } from "react";

// Minimal Web Speech API types (not in every TS lib.dom version).
type Alt = { transcript: string };
type Result = { isFinal: boolean; 0: Alt; length: number };
type RecEvent = { results: ArrayLike<Result> };
type Rec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};
type RecCtor = new () => Rec;

function ctor(): RecCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access was blocked. Allow it in your browser's site settings.",
  "service-not-allowed": "Speech recognition is disabled in this browser.",
  "audio-capture": "No microphone found.",
  network: "Speech recognition needs an internet connection.",
};

/**
 * Browser dictation (Chrome/Edge/Safari). Text = whatever was in the box when you started + what you said.
 * shortcut: Firefox has no Web Speech API, so the mic is hidden there; upgrade = record audio and transcribe with Gemini.
 */
export function useDictation(onText: (text: string) => void) {
  const supported = useSyncExternalStore(
    () => () => {},
    () => !!ctor(),
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Rec | null>(null);

  function start(base: string) {
    const Ctor = ctor();
    if (!Ctor || rec.current) return;
    setError(null);
    const r = new Ctor();
    r.lang = navigator.language || "en-IN";
    r.continuous = true;
    r.interimResults = true;
    const prefix = base.trim() ? base.trimEnd() + " " : "";
    r.onresult = (e) => {
      let said = "";
      for (let i = 0; i < e.results.length; i++) said += e.results[i][0].transcript;
      onText(prefix + said.trimStart());
    };
    r.onerror = (e) => {
      if (e.error !== "no-speech" && e.error !== "aborted") setError(ERRORS[e.error] ?? `Dictation failed (${e.error}).`);
    };
    r.onend = () => {
      rec.current = null;
      setListening(false);
    };
    rec.current = r;
    r.start();
    setListening(true);
  }

  function stop() {
    rec.current?.stop();
  }

  return { supported, listening, error, start, stop };
}
