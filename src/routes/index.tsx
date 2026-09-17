import { createFileRoute } from "@tanstack/react-router";
import { HeartPulse, Mic, ShoppingBasket, UsersRound, Check, ArrowLeft, Languages } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "../components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Smart Elderly Care — Help at Home" },
      { name: "description", content: "Simple, friendly access to medical support, daily needs, and family." },
      { property: "og:title", content: "Smart Elderly Care — Help at Home" },
      { property: "og:description", content: "Simple, friendly access to medical support, daily needs, and family." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type CareAction = "Medical Support" | "Daily Needs" | "Talk to Family";
type Screen = "home" | "listening" | "waiting" | "confirmation";
type LanguageCode = "en-IN" | "hi-IN" | "kn-IN";

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  length: number;
  [index: number]: { transcript: string };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionErrorLike = { error: string };

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

const LANGUAGES: Array<{ code: LanguageCode; label: string }> = [
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "हिंदी" },
  { code: "kn-IN", label: "ಕನ್ನಡ" },
];

const CONFIRMATION_SPEECH: Record<LanguageCode, string> = {
  "en-IN": "Your request has been confirmed",
  "hi-IN": "आपका अनुरोध स्वीकार कर लिया गया है",
  "kn-IN": "ನಿಮ್ಮ ವಿನಂತಿಯನ್ನು ದೃಢೀಕರಿಸಲಾಗಿದೆ",
};

function Index() {
  const [language, setLanguage] = useState<LanguageCode | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [selectedAction, setSelectedAction] = useState<CareAction>("Medical Support");
  const [transcript, setTranscript] = useState("");
  const [speechMessage, setSpeechMessage] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recognitionActiveRef = useRef(false);
  const speechReceivedRef = useRef(false);

  useEffect(() => {
    const savedLanguage = window.sessionStorage.getItem("care-language");
    if (savedLanguage === "en-IN" || savedLanguage === "hi-IN" || savedLanguage === "kn-IN") {
      setLanguage(savedLanguage);
    }
  }, []);

  useEffect(() => () => {
    recognitionActiveRef.current = false;
    recognitionRef.current?.abort();
    window.speechSynthesis?.cancel();
  }, []);

  const chooseLanguage = (code: LanguageCode) => {
    window.sessionStorage.setItem("care-language", code);
    setLanguage(code);
    setScreen("home");
  };

  const stopRecognition = () => {
    recognitionActiveRef.current = false;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
  };

  const startListening = (action: CareAction) => {
    setSelectedAction(action);
    setTranscript("");
    setSpeechMessage("");
    setScreen("listening");

    if (!language) return;

    const speechWindow = window as SpeechRecognitionWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechMessage("Voice recognition is not available in this browser. You can continue using the button below.");
      return;
    }

    stopRecognition();
    const recognition = new Recognition();
    recognition.lang = language;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognitionActiveRef.current = true;
    speechReceivedRef.current = false;
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      let heardText = "";
      for (let resultIndex = 0; resultIndex < event.results.length; resultIndex += 1) {
        const result = event.results[resultIndex];
        const alternative = result?.[0];
        if (alternative) heardText += `${alternative.transcript} `;
      }
      const cleanedText = heardText.trim();
      if (cleanedText) {
        speechReceivedRef.current = true;
        setTranscript(cleanedText);
      }
    };

    recognition.onerror = (event) => {
      if (!recognitionActiveRef.current) return;
      recognitionActiveRef.current = false;
      recognitionRef.current = null;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setSpeechMessage("Microphone access was not allowed. Please enable it in your browser settings, or continue using the button below.");
      } else if (event.error === "no-speech") {
        setSpeechMessage("I could not hear any speech. Please go back and try again, or continue using the button below.");
      } else {
        setSpeechMessage("Voice listening could not start. You can continue using the button below.");
      }
    };

    recognition.onend = () => {
      if (!recognitionActiveRef.current) return;
      recognitionActiveRef.current = false;
      recognitionRef.current = null;
      if (speechReceivedRef.current) setScreen("waiting");
    };

    try {
      recognition.start();
    } catch {
      recognitionActiveRef.current = false;
      recognitionRef.current = null;
      setSpeechMessage("Voice listening could not start. You can continue using the button below.");
    }
  };

  useEffect(() => {
    if (screen !== "waiting") return;

    const confirmationTimer = window.setTimeout(() => setScreen("confirmation"), 3000);
    return () => window.clearTimeout(confirmationTimer);
  }, [screen]);

  useEffect(() => {
    if (screen !== "confirmation" || !language || !("speechSynthesis" in window)) return;

    const speakConfirmation = () => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(CONFIRMATION_SPEECH[language]);
      utterance.lang = language;
      utterance.rate = 0.9;
      const voices = window.speechSynthesis.getVoices();
      const exactVoice = voices.find((voice) => voice.lang.toLowerCase() === language.toLowerCase());
      const languagePrefix = language.slice(0, 2).toLowerCase();
      const relatedVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith(languagePrefix));
      const fallbackVoice = voices.find((voice) => voice.default) ?? voices[0];
      const selectedVoice = exactVoice ?? relatedVoice ?? fallbackVoice;
      if (selectedVoice) {
        try {
          utterance.voice = selectedVoice;
        } catch {
          // The browser will use its default voice if an exposed voice cannot be assigned.
        }
      }
      window.speechSynthesis.speak(utterance);
    };

    speakConfirmation();
    window.speechSynthesis.addEventListener("voiceschanged", speakConfirmation, { once: true });
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", speakConfirmation);
      window.speechSynthesis.cancel();
    };
  }, [language, screen]);

  if (!language) {
    return (
      <main className="app-background relative grid min-h-svh place-items-center overflow-hidden px-6 py-5">
        <OrganicShapes />
        <section className="relative z-10 flex w-full max-w-md flex-col items-center text-center">
          <Languages className="size-16 text-microphone" strokeWidth={2.5} aria-hidden="true" />
          <h1 className="mt-5 text-4xl font-extrabold leading-tight text-foreground">Choose your language</h1>
          <div className="mt-8 grid w-full gap-4">
            {LANGUAGES.map((option) => (
              <Button
                key={option.code}
                onClick={() => chooseLanguage(option.code)}
                className="min-h-24 w-full rounded-2xl bg-card px-6 text-3xl font-extrabold text-card-foreground shadow-warm hover:bg-card"
              >
                {option.label}
              </Button>
            ))}
          </div>
        </section>
      </main>
    );
  }

  if (screen === "listening") {
    return (
      <main className="app-background relative grid min-h-svh place-items-center overflow-hidden px-6 py-5">
        <OrganicShapes />
        <section className="relative z-10 flex w-full max-w-md flex-col items-center text-center">
          <Button
            variant="quiet"
            onClick={() => {
              stopRecognition();
              setScreen("home");
            }}
            aria-label="Return to home"
            className="absolute left-0 top-0 size-14 rounded-full"
          >
            <ArrowLeft className="size-8" strokeWidth={2.5} />
          </Button>
          <div className="listening-pulse mt-14 grid size-36 place-items-center rounded-full bg-microphone text-microphone-foreground shadow-warm" aria-hidden="true">
            <Mic className="size-16" strokeWidth={2.5} />
          </div>
          <p className="mt-8 text-2xl font-bold text-muted-foreground">{selectedAction}</p>
          <h1 className="mt-2 text-4xl font-extrabold text-foreground">Listening...</h1>
          <label htmlFor="spoken-text" className="mt-8 self-start text-2xl font-bold text-foreground">
            What I heard
          </label>
          <textarea
            id="spoken-text"
            readOnly
            aria-label="Spoken text will appear here"
            value={transcript}
            className="mt-3 h-28 w-full resize-none rounded-3xl border-4 border-border bg-card p-4 text-2xl text-card-foreground shadow-soft focus:outline-none"
          />
          {speechMessage ? <p className="mt-4 text-2xl font-bold leading-snug text-foreground" role="alert">{speechMessage}</p> : null}
          <Button onClick={() => setScreen("waiting")} className="mt-7 min-h-16 w-full rounded-2xl px-8 text-2xl">
            Confirm Request
          </Button>
        </section>
      </main>
    );
  }

  if (screen === "waiting") {
    return (
      <main className="app-background relative grid min-h-svh place-items-center overflow-hidden px-6 py-5">
        <OrganicShapes />
        <section className="relative z-10 flex w-full max-w-md flex-col items-center text-center" aria-live="polite">
          <div className="waiting-dots flex h-20 items-center justify-center gap-4 text-medical" aria-hidden="true">
            <span className="size-6 rounded-full bg-current" />
            <span className="size-6 rounded-full bg-current" />
            <span className="size-6 rounded-full bg-current" />
          </div>
          <p className="mt-6 text-2xl font-bold text-muted-foreground">{selectedAction}</p>
          <h1 className="mt-3 max-w-sm text-4xl font-extrabold leading-tight text-foreground">
            Support is on the way, please wait
          </h1>
        </section>
      </main>
    );
  }

  if (screen === "confirmation") {
    return (
      <main className="app-background relative grid min-h-svh place-items-center overflow-hidden px-6 py-5">
        <OrganicShapes />
        <section className="relative z-10 flex w-full max-w-md flex-col items-center text-center">
          <div className="grid size-40 place-items-center rounded-full bg-success text-success-foreground shadow-warm" aria-hidden="true">
            <Check className="size-24" strokeWidth={3} />
          </div>
          <p className="mt-8 text-2xl font-bold text-muted-foreground">{selectedAction}</p>
          <h1 className="mt-3 text-4xl font-extrabold leading-tight text-foreground">Request confirmed</h1>
          <Button onClick={() => setScreen("home")} className="mt-12 min-h-20 w-full rounded-2xl px-8 text-3xl">
            Done
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-background relative flex min-h-svh items-center justify-center overflow-hidden px-2 py-4 sm:px-4">
      <OrganicShapes />
      <section className="relative z-10 flex h-[calc(100svh-2rem)] max-h-[820px] w-full max-w-lg flex-col items-center">
        <header className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3 pt-1">
          <div className="min-w-0">
            <p className="text-2xl font-extrabold leading-tight text-foreground">Good morning,</p>
            <h1 className="text-2xl font-extrabold leading-tight text-foreground">we’re here for you</h1>
          </div>
          <Button
            variant="quiet"
            size="icon"
            onClick={() => {
              window.sessionStorage.removeItem("care-language");
              setLanguage(null);
            }}
            aria-label="Change language"
            className="size-12 shrink-0 rounded-full bg-card/70 text-foreground shadow-soft hover:bg-card"
          >
            <Languages className="size-6" strokeWidth={2.5} />
          </Button>
        </header>

        <Button
          variant="quiet"
          onClick={() => startListening("Medical Support")}
          aria-label="Start voice assistant"
          className="central-microphone breathing-mic mt-3 grid size-28 shrink-0 place-items-center rounded-full border-4 border-background bg-microphone p-0 text-microphone-foreground shadow-warm hover:bg-microphone"
        >
          <Mic className="size-14" strokeWidth={2.5} />
        </Button>

        <div className="relative mt-4 min-h-0 w-full flex-1" aria-label="Care options">
          <CareButton
            label="Medical Support"
            icon={<HeartPulse className="size-16" strokeWidth={2.4} />}
            onClick={() => startListening("Medical Support")}
            className="left-1/2 top-0 -translate-x-1/2 bg-medical text-medical-foreground"
          />
          <CareButton
            label="Daily Needs"
            icon={<ShoppingBasket className="size-16" strokeWidth={2.4} />}
            onClick={() => startListening("Daily Needs")}
            className="bottom-0 left-0 bg-daily text-daily-foreground"
          />
          <CareButton
            label="Talk to Family"
            icon={<UsersRound className="size-16" strokeWidth={2.4} />}
            onClick={() => startListening("Talk to Family")}
            className="bottom-0 right-0 bg-family text-family-foreground"
          />
        </div>
      </section>
    </main>
  );
}

function CareButton({ label, icon, onClick, className }: { label: CareAction; icon: React.ReactNode; onClick: () => void; className: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`care-action absolute flex aspect-[0.9] w-[calc(50%-0.375rem)] max-w-56 min-w-[168px] flex-col items-center justify-center gap-3 rounded-[2.75rem] px-4 text-center text-2xl font-extrabold leading-tight shadow-warm transition-transform duration-200 focus-visible:z-30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background active:scale-[0.97] ${className}`}
      aria-label={label}
    >
      <span className="illustrated-icon grid size-16 place-items-center rounded-full" aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function OrganicShapes() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="organic-shape absolute -right-24 -top-20 size-64 bg-shape-gold" />
      <div className="organic-shape absolute -bottom-28 -left-28 size-72 rotate-45 bg-shape-sage" />
      <div className="organic-line absolute left-[-15%] top-[47%] h-28 w-[55%] rotate-[-12deg] rounded-[50%] border-4 border-shape-line" />
    </div>
  );
}
