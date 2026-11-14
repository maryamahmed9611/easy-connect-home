import { createFileRoute } from "@tanstack/react-router";
import { HeartPulse, Mic, ShoppingBasket, UsersRound, Check, ArrowLeft, Languages, HeartHandshake, PencilLine, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { sendWhatsAppAlert } from "@/lib/alerts.functions";
import {
  ACTION_LABEL,
  RESULT_HEADING,
  SPEECH_ISSUE_TEXT,
  UI_TEXT,
  callLabel,
  findSpokenContact,
  resultMessage,
  type LanguageCode,
  type ResultStatus,
  type SpeechIssue,
} from "@/lib/care-messages";

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

// Longest we wait for the WhatsApp step before showing an honest "could not confirm" result.
const ALERT_TIMEOUT_MS = 20000;

// What actually happened to the last request. The result screen is driven only by this.
// callName/callPhone: who the app dials, also shown as a big "Call …" button on the result screen.
type RequestOutcome = { status: ResultStatus; calling: boolean; callName: string; callPhone: string; showAllFamily: boolean };

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("timed out")), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

const LANGUAGE_KEY = "care-language";
const PROFILE_KEY = "care-profile";

type FamilyContact = { name: string; phone: string };
type CareProfile = { elderName: string; elderPhone?: string; contacts: FamilyContact[]; shop?: FamilyContact; ambulance?: FamilyContact };

function Index() {
  const [hydrated, setHydrated] = useState(false);
  const [profile, setProfile] = useState<CareProfile | null>(null);
  const [language, setLanguage] = useState<LanguageCode | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [selectedAction, setSelectedAction] = useState<CareAction>("Medical Support");
  const [transcript, setTranscript] = useState("");
  const [speechIssue, setSpeechIssue] = useState<SpeechIssue | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [outcome, setOutcome] = useState<RequestOutcome | null>(null);
  const submissionRef = useRef(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recognitionActiveRef = useRef(false);
  const speechReceivedRef = useRef(false);
  const transcriptRef = useRef("");

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem(LANGUAGE_KEY);
    if (savedLanguage === "en-IN" || savedLanguage === "hi-IN" || savedLanguage === "kn-IN") {
      setLanguage(savedLanguage);
    }
    const savedProfile = window.localStorage.getItem(PROFILE_KEY);
    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile) as CareProfile;
        if (parsed && typeof parsed.elderName === "string") {
          setProfile({ elderName: parsed.elderName, ...(typeof parsed.elderPhone === "string" && parsed.elderPhone ? { elderPhone: parsed.elderPhone } : {}), contacts: Array.isArray(parsed.contacts) ? parsed.contacts : [], ...(parsed.shop ? { shop: parsed.shop } : {}), ...(parsed.ambulance ? { ambulance: parsed.ambulance } : {}) });
        }
      } catch {
        // A damaged saved profile is ignored so setup can be completed again.
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => () => {
    recognitionActiveRef.current = false;
    recognitionRef.current?.abort();
    window.speechSynthesis?.cancel();
  }, []);

  const saveProfile = (newProfile: CareProfile) => {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(newProfile));
    setProfile(newProfile);
    const rows = [
      ...newProfile.contacts.map((c) => ({ name: c.name, relationship: "family", phone: c.phone, type: "family" })),
      ...(newProfile.shop?.phone ? [{ name: newProfile.shop.name, relationship: "shop owner", phone: newProfile.shop.phone, type: "shop" }] : []),
      ...(newProfile.ambulance?.phone ? [{ name: newProfile.ambulance.name || "Ambulance", relationship: "emergency", phone: newProfile.ambulance.phone, type: "ambulance" }] : []),
    ];
    if (rows.length) void supabase.from("contacts").insert(rows).then(({ error }) => { if (error) console.error("Could not save contacts", error.message); });
  };

  const getLocation = () =>
    new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      );
    });

  const chooseLanguage = (code: LanguageCode) => {
    window.localStorage.setItem(LANGUAGE_KEY, code);
    setLanguage(code);
    setScreen("home");
  };

  const stopRecognition = () => {
    recognitionActiveRef.current = false;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
  };

  // Saves the request, waits for the real WhatsApp result, and only then shows the result screen.
  const submitRequest = async (action: CareAction, details: string) => {
    const submission = ++submissionRef.current;
    setOutcome(null);
    setScreen("waiting");

    const finish = (status: ResultStatus, phone: string) => {
      if (submissionRef.current !== submission) return;
      // Only Talk to Family opens the phone dialer automatically; other requests just show Call buttons.
      const autoDial = requestType === "callback" && Boolean(phone);
      setOutcome({ status, calling: autoDial, callName, callPhone: phone, showAllFamily: requestType === "callback" });
      setScreen("confirmation");
      if (autoDial) window.location.href = telHref(phone);
    };

    // Medical and Talk to Family (call assistance) alert every family contact and dial the first one.
    // Daily Needs alerts the shop AND the family (so someone sees it even if the shop does not),
    // and dials the shop (or the second family contact if no shop is saved).
    const requestType = action === "Medical Support" ? "medical" : action === "Daily Needs" ? "groceries" : "callback";
    const familyPhones = (profile?.contacts ?? []).map((c) => c.phone).filter(Boolean);
    const shopContact = profile?.shop?.phone ? { name: profile.shop.name || "Shop", phone: profile.shop.phone } : profile?.contacts[1];
    // Talk to Family: if a saved name was spoken ("talk to C2"), call and alert only that person.
    const spokenContact = requestType === "callback" ? findSpokenContact(details, profile?.contacts ?? []) : undefined;
    const dialContact = requestType === "groceries" ? shopContact : spokenContact ?? profile?.contacts[0];
    const recipients = [
      ...new Set(
        requestType === "groceries"
          ? [profile?.shop?.phone ?? "", ...familyPhones]
          : spokenContact
            ? [spokenContact.phone]
            : familyPhones,
      ),
    ].filter(Boolean);
    const phone = dialContact?.phone ?? "";
    const callName = dialContact?.name ?? "";

    let savedId: string | null = null;
    try {
      const location = requestType === "callback" ? null : await getLocation();
      // The ID is created here because the app may only INSERT requests, not read them back
      // (asking for the new row with .select() is rejected by the database's security rules).
      const newId = crypto.randomUUID();
      const { error } = await supabase.from("requests").insert({
          id: newId,
          name: profile?.elderName ?? "",
          requestType,
          details,
          phone,
          latitude: location?.latitude ?? null,
          longitude: location?.longitude ?? null,
          fallback_phone: requestType === "medical" ? profile?.ambulance?.phone || null : null,
        });
      if (error) console.error(`Could not save request [${error.code}]: ${error.message}`);
      else savedId = newId;
    } catch (saveError) {
      console.error("Could not save request", saveError);
    }

    if (!savedId) {
      finish("failed", phone);
      return;
    }

    let alertSent = false;
    try {
      const result = await withTimeout(
        sendWhatsAppAlert({ data: { requestId: savedId, recipients, elderPhone: profile?.elderPhone ?? "" } }),
        ALERT_TIMEOUT_MS,
      );
      alertSent = result.sent;
      if (!result.sent) console.error(`WhatsApp alert not sent: ${result.reason}`);
    } catch (alertError) {
      console.error("WhatsApp alert failed", alertError);
    }
    finish(alertSent ? "sent" : "saved", phone);
  };

  const startListening = (action: CareAction) => {
    const listenLanguage = language;
    setSelectedAction(action);
    setTranscript("");
    transcriptRef.current = "";
    setOutcome(null);
    setSpeechIssue(null);
    setScreen("listening");

    if (!listenLanguage) return;

    const speechWindow = window as SpeechRecognitionWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechIssue("unsupported");
      return;
    }

    stopRecognition();
    const recognition = new Recognition();
    recognition.lang = listenLanguage;
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
        transcriptRef.current = cleanedText;
        setTranscript(cleanedText);
      }
    };

    recognition.onerror = (event) => {
      if (!recognitionActiveRef.current) return;
      recognitionActiveRef.current = false;
      recognitionRef.current = null;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setSpeechIssue("not_allowed");
      } else if (event.error === "no-speech") {
        setSpeechIssue("no_speech");
      } else {
        setSpeechIssue("could_not_start");
      }
    };

    recognition.onend = () => {
      if (!recognitionActiveRef.current) return;
      recognitionActiveRef.current = false;
      recognitionRef.current = null;
      if (speechReceivedRef.current) void submitRequest(action, transcriptRef.current);
    };

    try {
      recognition.start();
    } catch {
      recognitionActiveRef.current = false;
      recognitionRef.current = null;
      setSpeechIssue("could_not_start");
    }
  };

  useEffect(() => {
    if (screen !== "confirmation" || !language || !outcome || !("speechSynthesis" in window)) return;
    const spokenText = resultMessage(outcome.status, outcome.calling, language);

    const speakConfirmation = () => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(spokenText);
      utterance.lang = language;
      utterance.rate = 0.9;
      const voices = window.speechSynthesis.getVoices();
      const exactVoice = voices.find((voice) => voice.lang.toLowerCase() === language.toLowerCase());
      const languagePrefix = language.slice(0, 2).toLowerCase();
      const relatedVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith(languagePrefix));
      // Never force another language's voice (e.g. English) onto Hindi/Kannada text: if no matching
      // voice is listed, leave it unset so the phone picks one for utterance.lang itself.
      const selectedVoice = exactVoice ?? relatedVoice;
      if (selectedVoice) {
        try {
          utterance.voice = selectedVoice;
        } catch {
          // The browser will use its default voice if an exposed voice cannot be assigned.
        }
      }
      window.speechSynthesis.speak(utterance);
    };

    let cancelled = false;
    let audio: HTMLAudioElement | null = null;
    let objectUrl: string | null = null;
    const fallback = () => {
      if (cancelled) return;
      speakConfirmation();
      window.speechSynthesis.addEventListener("voiceschanged", speakConfirmation, { once: true });
    };
    fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang: language, status: outcome.status, calling: outcome.calling }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`tts ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        audio = new Audio(objectUrl);
        await audio.play();
      })
      .catch(fallback);
    return () => {
      cancelled = true;
      audio?.pause();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      window.speechSynthesis.removeEventListener("voiceschanged", speakConfirmation);
      window.speechSynthesis.cancel();
    };
  }, [language, screen, outcome]);

  // The result screen returns home on its own only when everything worked and there is no one to call;
  // otherwise it stays (with its Call button) until the person taps "Back to home".
  const resultIsSuccess = outcome?.status === "sent" || outcome?.status === "family";
  const autoReturnHome = resultIsSuccess && !outcome?.callPhone;

  useEffect(() => {
    if (screen !== "confirmation" || !autoReturnHome) return;

    const homeTimer = window.setTimeout(() => setScreen("home"), 4500);
    return () => window.clearTimeout(homeTimer);
  }, [screen, autoReturnHome]);

  if (!hydrated) {
    return <main className="app-background min-h-svh" aria-hidden="true" />;
  }

  if (!profile || editingProfile) {
    const setupSharedProps = {
      initialProfile: profile,
      isEditing: editingProfile,
      onComplete: (newProfile: CareProfile) => {
        // First-time setup always continues to the language page (chosen once, right after the contacts).
        if (!editingProfile) {
          window.localStorage.removeItem(LANGUAGE_KEY);
          setLanguage(null);
        }
        saveProfile(newProfile);
        setEditingProfile(false);
      },
    };
    return (
      profile
        ? <SetupScreen {...setupSharedProps} onCancel={() => setEditingProfile(false)} />
        : <SetupScreen {...setupSharedProps} />
    );
  }

  if (!language) {
    return (
      <main className="app-background relative grid min-h-svh place-items-center overflow-hidden px-6 py-5">
        <OrganicShapes />
        <section className="relative z-10 flex w-full max-w-md flex-col items-center text-center">
          <Languages className="size-16 text-microphone" strokeWidth={2.5} aria-hidden="true" />
          <h1 className="font-heading mt-5 text-4xl font-bold leading-tight text-foreground">Choose your language</h1>
          <div className="mt-8 grid w-full gap-4">
            {LANGUAGES.map((option) => (
              <Button
                key={option.code}
                onClick={() => chooseLanguage(option.code)}
                className="min-h-24 w-full rounded-2xl border border-border/60 bg-card px-6 text-3xl font-extrabold text-card-foreground shadow-warm hover:bg-card"
              >
                {option.label}
              </Button>
            ))}
          </div>
        </section>
      </main>
    );
  }

  // From here on a language has been chosen; every screen below speaks and shows text in it.
  const lang: LanguageCode = language;

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
          <p className="mt-8 text-2xl font-bold text-muted-foreground">{ACTION_LABEL[selectedAction][lang]}</p>
           <h1 className="font-heading mt-2 text-4xl font-bold text-foreground">{UI_TEXT.listening[lang]}</h1>
          <p className="mt-2 text-xl font-bold text-muted-foreground">{UI_TEXT.speakIn[lang]}</p>
          <label htmlFor="spoken-text" className="mt-8 self-start text-2xl font-bold text-foreground">
            {UI_TEXT.whatIHeard[lang]}
          </label>
          <textarea
            id="spoken-text"
            readOnly
            aria-label="Spoken text will appear here"
            value={transcript}
            className="mt-3 h-28 w-full resize-none rounded-3xl border-4 border-border bg-card p-4 text-2xl text-card-foreground shadow-soft focus:outline-none"
          />
          {speechIssue ? <p className="mt-4 text-2xl font-bold leading-snug text-foreground" role="alert">{SPEECH_ISSUE_TEXT[speechIssue][lang]}</p> : null}
          <Button
            onClick={() => {
              stopRecognition();
              void submitRequest(selectedAction, transcriptRef.current || transcript);
            }}
            className="mt-7 min-h-16 w-full rounded-2xl px-8 text-2xl"
          >
            {UI_TEXT.confirm[lang]}
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
          <p className="mt-6 text-2xl font-bold text-muted-foreground">{ACTION_LABEL[selectedAction][lang]}</p>
           <h1 className="font-heading mt-3 max-w-sm text-4xl font-bold leading-tight text-foreground">
            {UI_TEXT.sending[lang]}
          </h1>
        </section>
      </main>
    );
  }

  if (screen === "confirmation" && outcome) {
    return (
      <main className="app-background relative grid min-h-svh place-items-center overflow-hidden px-6 py-5">
        <OrganicShapes />
        <section className="relative z-10 flex w-full max-w-md flex-col items-center text-center" aria-live="polite">
          {resultIsSuccess ? (
            <div className="grid size-40 place-items-center rounded-full bg-success text-success-foreground shadow-warm" aria-hidden="true">
              <Check className="size-24" strokeWidth={3} />
            </div>
          ) : (
            <div className="grid size-40 place-items-center rounded-full bg-destructive text-destructive-foreground shadow-warm" aria-hidden="true">
              <TriangleAlert className="size-24" strokeWidth={2.5} />
            </div>
          )}
          <p className="mt-8 text-2xl font-bold text-muted-foreground">{ACTION_LABEL[selectedAction][lang]}</p>
          <h1 className="font-heading mt-3 text-4xl font-bold leading-tight text-foreground">{RESULT_HEADING[outcome.status][lang]}</h1>
          <p className="mt-4 text-2xl font-semibold text-foreground">{resultMessage(outcome.status, outcome.calling, lang)}</p>
          {/* Talk to Family: one button per saved contact (the one being dialled first), so the right person can always be tapped. */}
          {outcome.showAllFamily &&
            [...profile.contacts]
              .filter((contact) => contact.phone)
              .sort((a, b) => Number(b.phone === outcome.callPhone) - Number(a.phone === outcome.callPhone))
              .map((contact) => (
                <a
                  key={`${contact.name}-${contact.phone}`}
                  href={telHref(contact.phone)}
                  className={`mt-5 flex min-h-[88px] w-full items-center justify-center rounded-[2rem] px-6 text-3xl font-bold shadow-warm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring ${
                    contact.phone === outcome.callPhone ? "bg-primary text-primary-foreground" : "border-4 border-border bg-card text-card-foreground"
                  }`}
                >
                  {callLabel(contact.name, lang)}
                </a>
              ))}
          {!outcome.showAllFamily && outcome.callPhone && (
            <a
              href={telHref(outcome.callPhone)}
              className="mt-8 flex min-h-[100px] w-full items-center justify-center rounded-[2rem] bg-primary px-6 text-3xl font-bold text-primary-foreground shadow-warm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
            >
              {callLabel(outcome.callName, lang)}
            </a>
          )}
          {selectedAction === "Medical Support" && profile.ambulance?.phone && (
            <a
              href={telHref(profile.ambulance.phone)}
              className="mt-8 flex min-h-[100px] w-full items-center justify-center rounded-[2rem] bg-destructive px-6 text-3xl font-bold text-destructive-foreground shadow-warm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
            >
              {UI_TEXT.callAmbulance[lang]}
            </a>
          )}
          {!autoReturnHome && (
            <Button variant="quiet" onClick={() => setScreen("home")} className="mt-6 min-h-16 w-full text-2xl">
              {UI_TEXT.backHome[lang]}
            </Button>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="app-background relative flex min-h-svh items-center justify-center overflow-hidden px-2 py-4 sm:px-4">
      <OrganicShapes />
      <section className="relative z-10 flex h-[calc(100svh-2rem)] max-h-[820px] w-full max-w-lg flex-col items-center">
        <header className="grid w-full grid-cols-[3rem_minmax(0,1fr)_3rem] items-start gap-3 pt-1">
          <Button
            variant="quiet"
            size="icon"
            onClick={() => setEditingProfile(true)}
            aria-label="Edit details"
            title="Edit details"
            className="size-12 shrink-0 rounded-full border border-border/50 bg-card/80 text-foreground shadow-soft hover:bg-card"
          >
            <PencilLine className="size-6" strokeWidth={2} />
          </Button>
          <div className="min-w-0 text-center">
            <p className="font-heading text-2xl font-bold leading-tight text-foreground">
              Good morning{profile.elderName ? `, ${profile.elderName}` : ","}
            </p>
            <h1 className="font-heading text-2xl font-bold leading-tight text-foreground">we’re here for you</h1>
          </div>
          <Button
            variant="quiet"
            size="icon"
            onClick={() => {
              window.localStorage.removeItem(LANGUAGE_KEY);
              setLanguage(null);
            }}
            aria-label="Change language"
            title="Change language"
            className="size-12 shrink-0 rounded-full border border-border/50 bg-card/80 text-foreground shadow-soft hover:bg-card"
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

        <div className="relative mt-4 h-[26rem] w-full shrink-0" aria-label="Care options">
          <CareButton
            label="Medical Support"
            icon={<HeartPulse className="size-16" strokeWidth={2.4} />}
            onClick={() => startListening("Medical Support")}
            className="care-medical left-1/2 top-0 -translate-x-1/2 text-medical-foreground"
          />
          <CareButton
            label="Daily Needs"
            icon={<ShoppingBasket className="size-16" strokeWidth={2.4} />}
            onClick={() => startListening("Daily Needs")}
            className="care-daily bottom-0 left-0 text-daily-foreground"
          />
          <CareButton
            label="Talk to Family"
            icon={<UsersRound className="size-16" strokeWidth={2.4} />}
            onClick={() => startListening("Talk to Family")}
            className="care-family bottom-0 right-0 text-family-foreground"
          />
        </div>
      </section>
    </main>
  );
}

function SetupScreen({ initialProfile, isEditing, onCancel, onComplete }: { initialProfile: CareProfile | null; isEditing: boolean; onCancel?: () => void; onComplete: (profile: CareProfile) => void }) {
  const [elderName, setElderName] = useState(initialProfile?.elderName ?? "");
  const [elderPhone, setElderPhone] = useState(initialProfile?.elderPhone ?? "");
  const [contacts, setContacts] = useState<FamilyContact[]>(() => Array.from({ length: 3 }, (_, index) => initialProfile?.contacts[index] ?? { name: "", phone: "" }));
  const [shop, setShop] = useState<FamilyContact>(() => initialProfile?.shop ?? { name: "", phone: "" });
  const [ambulance, setAmbulance] = useState<FamilyContact>(() => initialProfile?.ambulance ?? { name: "", phone: "" });
  const [error, setError] = useState("");

  const updateContact = (index: number, field: keyof FamilyContact, value: string) => {
    setContacts((current) => current.map((contact, position) => (position === index ? { ...contact, [field]: value } : contact)));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = elderName.trim();
    const filledContacts = contacts
      .map((contact) => ({ name: contact.name.trim(), phone: contact.phone.trim() }))
      .filter((contact) => contact.name && contact.phone);

    if (!trimmedName) {
      setError("Please enter the name of the person using this app.");
      return;
    }
    const hasIncompleteContact = contacts.some((contact) => Boolean(contact.name.trim()) !== Boolean(contact.phone.trim()));
    if (hasIncompleteContact) {
      setError("Please add both a name and phone number for each contact, or leave both fields empty.");
      return;
    }
    if (!isEditing && filledContacts.length < 2) {
      setError("Please add at least two family contacts with a name and a phone number.");
      return;
    }

    setError("");
    const trimmedShop = { name: shop.name.trim(), phone: shop.phone.trim() };
    onComplete({ elderName: trimmedName, ...(elderPhone.trim() ? { elderPhone: elderPhone.trim() } : {}), contacts: filledContacts, ...(trimmedShop.phone ? { shop: trimmedShop } : {}), ...(ambulance.phone.trim() ? { ambulance: { name: ambulance.name.trim(), phone: ambulance.phone.trim() } } : {}) });
  };

  const moveToNextField = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    const form = event.currentTarget.form;
    if (!form) return;
    const fields = Array.from(form.querySelectorAll<HTMLInputElement>("[data-setup-field]"));
    const currentIndex = fields.indexOf(event.currentTarget);
    const nextField = fields[currentIndex + 1];
    if (nextField) {
      event.preventDefault();
      nextField.focus();
    }
  };

  return (
    <main className="app-background relative min-h-svh overflow-hidden px-6 py-8">
      <OrganicShapes />
      <form onSubmit={handleSubmit} className="relative z-10 mx-auto flex w-full max-w-md flex-col items-center">
        <HeartHandshake className="size-14 text-microphone" strokeWidth={2.5} aria-hidden="true" />
        <h1 className="font-heading mt-4 text-center text-4xl font-bold leading-tight text-foreground">{isEditing ? "Edit your details" : "Let’s set things up"}</h1>
        <p className="mt-3 text-center text-xl font-bold leading-snug text-muted-foreground">
          {isEditing ? "Update the saved name and family contacts." : "A family member can fill this in once. We will remember it."}
        </p>

        <label htmlFor="elder-name" className="mt-8 w-full text-2xl font-bold text-foreground">
          Name of the person using this app
        </label>
        <Input
          id="elder-name"
          data-setup-field
          value={elderName}
          onChange={(event) => setElderName(event.target.value)}
          onKeyDown={moveToNextField}
          placeholder="Name"
          className="mt-3 h-16 w-full rounded-2xl border-4 border-border bg-card px-4 text-2xl text-card-foreground shadow-soft md:text-2xl"
        />

        <label htmlFor="elder-phone" className="mt-6 w-full text-2xl font-bold text-foreground">
          Their phone number (optional)
        </label>
        <Input
          id="elder-phone"
          data-setup-field
          type="tel"
          inputMode="tel"
          value={elderPhone}
          onChange={(event) => setElderPhone(event.target.value)}
          onKeyDown={moveToNextField}
          placeholder="So family can call back"
          className="mt-3 h-16 w-full rounded-2xl border-4 border-border bg-card px-4 text-2xl text-card-foreground shadow-soft md:text-2xl"
        />

        <h2 className="font-heading mt-8 w-full text-3xl font-bold text-foreground">Family contacts</h2>
        {contacts.map((contact, index) => (
          <div key={index} className="mt-4 w-full rounded-3xl bg-card/70 p-4 shadow-soft">
            <label htmlFor={`contact-name-${index}`} className="text-xl font-bold text-foreground">
              Contact {index + 1}
              {index === 2 ? " (optional)" : ""}
            </label>
            <Input
              id={`contact-name-${index}`}
              data-setup-field
              value={contact.name}
              onChange={(event) => updateContact(index, "name", event.target.value)}
              onKeyDown={moveToNextField}
              placeholder="Name"
              className="mt-2 h-14 w-full rounded-2xl border-4 border-border bg-card px-4 text-xl text-card-foreground md:text-xl"
            />
            <Input
              id={`contact-phone-${index}`}
              data-setup-field
              type="tel"
              inputMode="tel"
              aria-label={`Phone number for contact ${index + 1}`}
              value={contact.phone}
              onChange={(event) => updateContact(index, "phone", event.target.value)}
              onKeyDown={moveToNextField}
              placeholder="Phone number"
              className="mt-3 h-14 w-full rounded-2xl border-4 border-border bg-card px-4 text-xl text-card-foreground md:text-xl"
            />
          </div>
        ))}

        <h2 className="font-heading mt-8 w-full text-3xl font-bold text-foreground">Shop owner (for daily needs)</h2>
        <div className="mt-4 w-full rounded-3xl bg-card/70 p-4 shadow-soft">
          <label htmlFor="shop-name" className="text-xl font-bold text-foreground">Shop (optional)</label>
          <Input
            id="shop-name"
            data-setup-field
            value={shop.name}
            onChange={(event) => setShop((current) => ({ ...current, name: event.target.value }))}
            onKeyDown={moveToNextField}
            placeholder="Shop or owner name"
            className="mt-2 h-14 w-full rounded-2xl border-4 border-border bg-card px-4 text-xl text-card-foreground md:text-xl"
          />
          <Input
            id="shop-phone"
            data-setup-field
            type="tel"
            inputMode="tel"
            aria-label="Phone number for the shop owner"
            value={shop.phone}
            onChange={(event) => setShop((current) => ({ ...current, phone: event.target.value }))}
            onKeyDown={moveToNextField}
            placeholder="Phone number"
            className="mt-3 h-14 w-full rounded-2xl border-4 border-border bg-card px-4 text-xl text-card-foreground md:text-xl"
          />
        </div>

        <h2 className="font-heading mt-8 w-full text-3xl font-bold text-foreground">Ambulance (if family does not answer)</h2>
        <div className="mt-4 w-full rounded-3xl bg-card/70 p-4 shadow-soft">
          <label htmlFor="ambulance-phone" className="text-xl font-bold text-foreground">Ambulance number (optional)</label>
          <Input
            id="ambulance-phone"
            data-setup-field
            type="tel"
            inputMode="tel"
            value={ambulance.phone}
            onChange={(event) => setAmbulance({ name: "Ambulance", phone: event.target.value })}
            onKeyDown={moveToNextField}
            placeholder="Ambulance phone number"
            className="mt-2 h-14 w-full rounded-2xl border-4 border-border bg-card px-4 text-xl text-card-foreground md:text-xl"
          />
        </div>

        {error ? <p className="mt-5 w-full text-xl font-bold leading-snug text-foreground" role="alert">{error}</p> : null}

        <div className="mb-4 mt-8 grid w-full gap-3">
          <Button type="submit" className="min-h-20 w-full rounded-2xl px-8 text-3xl">
            {isEditing ? "Save details" : "Save and continue"}
          </Button>
          {onCancel ? <Button type="button" variant="quiet" onClick={onCancel} className="min-h-14 w-full text-xl">Cancel</Button> : null}
        </div>
      </form>
    </main>
  );
}

function CareButton({ label, icon, onClick, className }: { label: CareAction; icon: React.ReactNode; onClick: () => void; className: string }) {
  return (
    <Button
      variant="quiet"
      type="button"
      onClick={onClick}
      className={`care-action absolute flex aspect-[0.9] h-auto w-[calc(50%-0.5rem)] max-w-56 min-w-[168px] whitespace-normal flex-col items-center justify-center gap-3 rounded-[2.5rem] border border-card/60 px-3 text-center text-2xl font-extrabold leading-tight shadow-warm transition-transform duration-200 focus-visible:z-30 focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background active:scale-[0.97] ${className}`}
      aria-label={label}
    >
      <span className="illustrated-icon grid size-20 place-items-center rounded-full" aria-hidden="true">{icon}</span>
      <span className="max-w-full text-balance">{label}</span>
    </Button>
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
