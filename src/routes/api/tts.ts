import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const PHRASES = {
  "en-IN": { alert: "Help alert sent. Calling now.", done: "Your request has been confirmed." },
  "hi-IN": { alert: "मदद का संदेश भेज दिया गया है। अभी कॉल कर रहे हैं।", done: "आपका अनुरोध स्वीकार कर लिया गया है।" },
  "kn-IN": { alert: "ಸಹಾಯದ ಸಂದೇಶ ಕಳುಹಿಸಲಾಗಿದೆ. ಈಗ ಕರೆ ಮಾಡಲಾಗುತ್ತಿದೆ.", done: "ನಿಮ್ಮ ವಿನಂತಿಯನ್ನು ದೃಢೀಕರಿಸಲಾಗಿದೆ." },
} as const;

const schema = z.object({ lang: z.enum(["en-IN", "hi-IN", "kn-IN"]), kind: z.enum(["alert", "done"]) });

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Invalid request", { status: 400 });
        const key = process.env["SMALLEST_AI_API_KEY"];
        if (!key) return new Response("Voice service not configured", { status: 500 });
        const { lang, kind } = parsed.data;
        const upstream = await fetch("https://waves-api.smallest.ai/api/v1/lightning-v3.1/get_speech", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            text: PHRASES[lang][kind],
            voice_id: "srishti",
            language: lang.slice(0, 2),
            sample_rate: 24000,
            add_wav_header: true,
          }),
        });
        if (!upstream.ok || !upstream.body) {
          console.error(`[tts] Smallest AI failed [${upstream.status}]: ${await upstream.text()}`);
          return new Response("Voice unavailable", { status: upstream.status === 429 ? 429 : 502 });
        }
        return new Response(upstream.body, {
          headers: { "Content-Type": "audio/wav", "Cache-Control": "public, max-age=86400" },
        });
      },
    },
  },
});
