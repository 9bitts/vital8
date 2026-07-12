"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: { results: { length: number; item: (i: number) => { 0?: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRec;

export function MobileVoiceInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<SpeechRec | null>(null);

  useEffect(() => {
    const w = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    setSupported(true);
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (ev) => {
      const text = Array.from({ length: ev.results.length })
        .map((_, i) => ev.results.item(i)[0]?.transcript ?? "")
        .join(" ");
      onChange(text);
    };
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
  }, [onChange]);

  function toggle() {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (listening) {
      rec.stop();
      setListening(false);
    } else {
      rec.start();
      setListening(true);
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full rounded-md border px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      {supported && (
        <button
          type="button"
          onClick={toggle}
          className={`flex min-h-11 items-center gap-2 rounded-md border px-4 text-sm dark:border-zinc-700 ${
            listening ? "border-red-300 text-red-700" : ""
          }`}
        >
          {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          {listening ? "Parar ditado" : "Ditado por voz"}
        </button>
      )}
    </div>
  );
}
