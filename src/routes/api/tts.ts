import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { RESULT_STATUSES, resultMessage } from "@/lib/care-messages";

// Only fixed, pre-written phrases can be spoken, so this route cannot be used to voice arbitrary text.
const schema = z.object({
  lang: z.enum(["en-IN", "hi-IN", "kn-IN"]),
  status: z.enum(RESULT_STATUSES),
  calling: z.boolean(),
});

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Invalid request", { status: 400 });
        const key = process.env["SMALLEST_AI_API_KEY"];
        if (!key) return new Response("Voice service not configured", { status: 500 });
        const { lang, status, calling } = parsed.data;
        const upstream = await fetch("https://waves-api.smallest.ai/api/v1/lightning-v3.1/get_speech", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            text: resultMessage(status, calling, lang),
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
