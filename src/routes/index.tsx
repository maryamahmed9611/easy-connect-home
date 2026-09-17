import { createFileRoute } from "@tanstack/react-router";
import { HeartPulse, Mic, ShoppingBasket, UsersRound, Check, ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";

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

function Index() {
  const [screen, setScreen] = useState<Screen>("home");
  const [selectedAction, setSelectedAction] = useState<CareAction>("Medical Support");

  const startListening = (action: CareAction) => {
    setSelectedAction(action);
    setScreen("listening");
  };

  useEffect(() => {
    if (screen !== "waiting") return;

    const confirmationTimer = window.setTimeout(() => setScreen("confirmation"), 3000);
    return () => window.clearTimeout(confirmationTimer);
  }, [screen]);

  if (screen === "listening") {
    return (
      <main className="app-background relative grid min-h-svh place-items-center overflow-hidden px-6 py-5">
        <OrganicShapes />
        <section className="relative z-10 flex w-full max-w-md flex-col items-center text-center">
          <Button
            variant="quiet"
            onClick={() => setScreen("home")}
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
            className="mt-3 h-28 w-full resize-none rounded-3xl border-4 border-border bg-card p-4 text-2xl text-card-foreground shadow-soft focus:outline-none"
          />
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
        <header className="w-full pt-1">
          <div className="min-w-0">
            <p className="text-2xl font-extrabold leading-tight text-foreground">Good morning,</p>
            <h1 className="text-2xl font-extrabold leading-tight text-foreground">we’re here for you</h1>
          </div>
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
