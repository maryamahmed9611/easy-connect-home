import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

const bodySchema = z.object({ request_id: z.string().uuid() });
const callbackSchema = z.object({
  request_id: z.string().uuid(),
  target: z.enum(["primary", "fallback"]),
  sig: z.string().min(10),
});

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function toE164(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  return `+91${digits.replace(/^0/, "")}`;
}

function sign(secret: string, requestId: string, target: string): string {
  return createHmac("sha256", secret).update(`${requestId}:${target}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

async function twilioPost(accountSid: string, authToken: string, resource: string, form: Record<string, string>) {
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/${resource}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(form),
  });
  const body = await response.text();
  if (!response.ok) console.error(`[twilio-notify] Twilio ${resource} failed [${response.status}]: ${body}`);
  return { ok: response.ok, status: response.status, body };
}

const say = (text: string) => `<Say voice="alice" language="en-IN">${escapeXml(text)}</Say>`;
const emptyTwiml = () => new Response("<Response/>", { headers: { "Content-Type": "text/xml" } });

export const Route = createFileRoute("/api/public/twilio-notify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["TWILIO_NOTIFY_SECRET"];
        const accountSid = process.env["TWILIO_ACCOUNT_SID"];
        const authToken = process.env["TWILIO_AUTH_TOKEN"];
        const fromNumber = process.env["TWILIO_PHONE_NUMBER"];
        if (!secret || !accountSid || !authToken || !fromNumber) {
          console.error("[twilio-notify] Missing Twilio configuration");
          return new Response("Notification service is not configured", { status: 500 });
        }

        const url = new URL(request.url);
        const origin = `https://${url.host}`;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const loadRow = async (id: string) =>
          supabaseAdmin
            .from("requests")
            .select("id, name, details, phone, requestType, status, latitude, longitude, fallback_phone")
            .eq("id", id)
            .maybeSingle();

        const callbackUrl = (id: string, target: "primary" | "fallback") =>
          `${origin}/api/public/twilio-notify?stage=status&request_id=${id}&target=${target}&sig=${sign(secret, id, target)}`;

        const placeCall = (id: string, to: string, twiml: string, target: "primary" | "fallback") =>
          twilioPost(accountSid, authToken, "Calls.json", {
            To: to,
            From: fromNumber,
            Twiml: twiml,
            Timeout: "25",
            StatusCallback: callbackUrl(id, target),
            StatusCallbackEvent: "completed",
            StatusCallbackMethod: "POST",
          });

        const medicalTwiml = (name: string) => {
          const spoken = `Medical help is needed for ${name}, please check WhatsApp for their location.`;
          return `<Response>${say(spoken)}<Pause length="1"/>${say(spoken)}</Response>`;
        };

        // ---- Twilio status callback (call finished / not answered) ----
        if (url.searchParams.get("stage") === "status") {
          const params = callbackSchema.safeParse(Object.fromEntries(url.searchParams));
          if (!params.success || !safeEqual(params.data.sig, sign(secret, params.data.request_id, params.data.target))) {
            return new Response("Unauthorized", { status: 401 });
          }
          const form = await request.formData().catch(() => null);
          const callStatus = String(form?.get("CallStatus") ?? "");
          const { data: row, error } = await loadRow(params.data.request_id);
          if (error || !row) {
            console.error(`[twilio-notify] Callback could not load request ${params.data.request_id}: ${error?.message ?? "not found"}`);
            return emptyTwiml();
          }

          if (callStatus === "completed") {
            const { error: updateError } = await supabaseAdmin.from("requests").update({ status: "confirmed" }).eq("id", row.id);
            if (updateError) console.error(`[twilio-notify] Failed to confirm request ${row.id}: ${updateError.message}`);
            return emptyTwiml();
          }

          console.error(`[twilio-notify] Call for request ${row.id} (${params.data.target}) ended with status "${callStatus}"`);
          if (row.requestType === "medical" && params.data.target === "primary" && row.fallback_phone) {
            const fallback = await placeCall(row.id, toE164(row.fallback_phone), medicalTwiml(row.name?.trim() || "your family member"), "fallback");
            if (!fallback.ok) console.error(`[twilio-notify] Ambulance call failed for request ${row.id}; status left pending`);
          } else {
            console.error(`[twilio-notify] No one answered for request ${row.id}; status left pending`);
          }
          return emptyTwiml();
        }

        // ---- Initial notification from the database trigger ----
        const auth = request.headers.get("authorization") ?? "";
        if (!safeEqual(auth, `Bearer ${secret}`)) return new Response("Unauthorized", { status: 401 });

        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Invalid request body", { status: 400 });

        const { data: row, error } = await loadRow(parsed.data.request_id);
        if (error) {
          console.error(`[twilio-notify] Failed to load request: ${error.message}`);
          return new Response("Could not load request", { status: 500 });
        }
        if (!row) return new Response("Request not found", { status: 404 });
        if (!row.phone) {
          console.error(`[twilio-notify] Request ${row.id} has no phone number; status left pending`);
          return new Response("Request has no phone number", { status: 422 });
        }

        const to = toE164(row.phone);
        const name = row.name?.trim() || "your family member";
        const details = row.details?.trim() || "No details were captured.";
        let twiml: string;
        let whatsappBody: string;

        if (row.requestType === "medical") {
          twiml = medicalTwiml(name);
          const mapLink =
            row.latitude != null && row.longitude != null
              ? `https://www.google.com/maps?q=${row.latitude},${row.longitude}`
              : "Location could not be captured.";
          whatsappBody = `Medical help is needed for ${name}.\n\nLocation: ${mapLink}\n\nDetails: ${details}`;
        } else if (row.requestType === "groceries") {
          const spoken = `New grocery order for ${name}. ${details}. Press 1 to confirm this order.`;
          twiml = `<Response><Gather numDigits="1" timeout="10">${say(spoken)}</Gather>${say(spoken)}</Response>`;
          whatsappBody = `New grocery order for ${name}.\n\nOrder: ${details}`;
        } else {
          return new Response("No notification needed", { status: 200 });
        }

        const call = await placeCall(row.id, to, twiml, "primary");
        const whatsapp = await twilioPost(accountSid, authToken, "Messages.json", {
          To: `whatsapp:${to}`,
          From: `whatsapp:${fromNumber}`,
          Body: whatsappBody,
        });

        if (!call.ok) {
          if (row.requestType === "medical" && row.fallback_phone) {
            const fallback = await placeCall(row.id, toE164(row.fallback_phone), twiml, "fallback");
            if (fallback.ok) return Response.json({ ok: true, call: "fallback", whatsapp: whatsapp.ok });
          }
          console.error(`[twilio-notify] Call failed for request ${row.id}; status left pending`);
          return new Response(`Twilio call failed [${call.status}]: ${call.body}`, { status: 502 });
        }

        // Status becomes "confirmed" only when Twilio reports the call completed (status callback).
        return Response.json({ ok: true, call: true, whatsapp: whatsapp.ok });
      },
    },
  },
});
