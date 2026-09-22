import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({ request_id: z.string().uuid() });

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toE164(raw: string): string {
  const trimmed = raw.replace(/[^\d+]/g, "");
  if (trimmed.startsWith("+")) return trimmed;
  if (trimmed.length === 10) return `+91${trimmed}`;
  return `+${trimmed}`;
}

async function twilioPost(
  accountSid: string,
  authToken: string,
  resource: string,
  form: Record<string, string>,
): Promise<{ ok: boolean; status: number; body: string }> {
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/${resource}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(form),
    },
  );
  const body = await response.text();
  if (!response.ok) {
    console.error(`Twilio ${resource} failed [${response.status}]: ${body}`);
  }
  return { ok: response.ok, status: response.status, body };
}

export const Route = createFileRoute("/api/public/twilio-notify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["TWILIO_NOTIFY_SECRET"];
        const accountSid = process.env["TWILIO_ACCOUNT_SID"];
        const authToken = process.env["TWILIO_AUTH_TOKEN"];
        const fromNumber = process.env["TWILIO_PHONE_NUMBER"];

        if (!secret || !accountSid || !authToken || !fromNumber) {
          return new Response("Notification service is not configured", { status: 500 });
        }

        if (request.headers.get("authorization") !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }

        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return new Response("Invalid request body", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row, error } = await supabaseAdmin
          .from("requests")
          .select("id, name, details, phone, requestType, status")
          .eq("id", parsed.data.request_id)
          .maybeSingle();

        if (error) {
          console.error(`Failed to load request: ${error.message}`);
          return new Response("Could not load request", { status: 500 });
        }
        if (!row) return new Response("Request not found", { status: 404 });
        if (!row.phone) return new Response("Request has no phone number", { status: 422 });

        const to = toE164(row.phone);
        const elderName = row.name?.trim() || "your family member";
        const details = row.details?.trim() || "No details were captured.";

        let twiml: string;
        let whatsappBody: string;

        if (row.requestType === "medical") {
          const spoken = `Medical help is needed for ${elderName}, please check your messages for their location.`;
          twiml = `<Response><Say voice="alice" language="en-IN">${escapeXml(spoken)}</Say><Pause length="1"/><Say voice="alice" language="en-IN">${escapeXml(spoken)}</Say></Response>`;
          whatsappBody = `Medical help is needed for ${elderName}.\n\nDetails: ${details}`;
        } else if (row.requestType === "groceries") {
          const spoken = `New grocery order for ${elderName}. ${details}. Press 1 to confirm this order.`;
          twiml = `<Response><Gather numDigits="1" timeout="10"><Say voice="alice" language="en-IN">${escapeXml(spoken)}</Say></Gather><Say voice="alice" language="en-IN">${escapeXml(spoken)}</Say></Response>`;
          whatsappBody = `New grocery order for ${elderName}.\n\nOrder: ${details}`;
        } else {
          return new Response("No notification needed", { status: 200 });
        }

        const call = await twilioPost(accountSid, authToken, "Calls.json", {
          To: to,
          From: fromNumber,
          Twiml: twiml,
        });

        const whatsapp = await twilioPost(accountSid, authToken, "Messages.json", {
          To: `whatsapp:${to}`,
          From: `whatsapp:${fromNumber}`,
          Body: whatsappBody,
        });

        if (!call.ok && !whatsapp.ok) {
          return new Response(
            `Twilio failed. Call [${call.status}]: ${call.body} WhatsApp [${whatsapp.status}]: ${whatsapp.body}`,
            { status: 502 },
          );
        }

        const { error: updateError } = await supabaseAdmin
          .from("requests")
          .update({ status: "confirmed" })
          .eq("id", row.id);

        if (updateError) {
          console.error(`Failed to confirm request: ${updateError.message}`);
          return new Response("Could not update request status", { status: 500 });
        }

        return Response.json({ ok: true, call: call.ok, whatsapp: whatsapp.ok });
      },
    },
  },
});
