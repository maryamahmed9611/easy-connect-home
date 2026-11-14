import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Approved WhatsApp templates (WhatsApp Manager → Message templates). Every template has four
// body placeholders {{1}}–{{4}}. If a template send fails (wrong name, not approved yet), the
// alert falls back to a plain text message, which Meta delivers within the 24-hour window.
// TODO: confirm the exact template names in WhatsApp Manager.
const TEMPLATES = {
  medical: { name: "elderly_assistance_alert", language: "en" },
  groceries: { name: "grocery_request_alert", language: "en" },
  callback: { name: "call_assistsance_request", language: "en" },
} as const;

type RequestType = keyof typeof TEMPLATES;

const MAX_RECIPIENTS = 5;

function toE164(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  return `+91${digits.replace(/^0/, "")}`;
}

const isValidE164 = (value: string) => /^\+\d{10,15}$/.test(value);

// Meta rejects template values that are empty or contain new lines, tabs or 4+ spaces in a row.
function param(value: string | null | undefined, max = 300): string {
  const cleaned = (value ?? "").replace(/[\r\n\t]+/g, " ").replace(/ {4,}/g, "   ").trim().slice(0, max);
  return cleaned || "-";
}

export type AlertReason =
  | "sent"
  | "already_sent"
  | "send_failed"
  | "not_configured"
  | "no_phone"
  | "not_found"
  | "already_handled";

type SendResult = { ok: boolean; detail: string };

async function postToMeta(token: string, phoneNumberId: string, payload: object): Promise<SendResult> {
  try {
    const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
    });
    if (response.ok) return { ok: true, detail: "ok" };
    return { ok: false, detail: `[${response.status}] ${(await response.text()).slice(0, 300)}` };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "network error" };
  }
}

// Sends the WhatsApp alert for a saved request to each recipient, then marks it confirmed.
// The request is marked "confirmed" ONLY when Meta accepts at least one message.
export const sendWhatsAppAlert = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        requestId: z.string().uuid(),
        recipients: z.array(z.string().max(24)).max(MAX_RECIPIENTS).optional(),
        elderPhone: z.string().max(24).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ sent: boolean; reason: AlertReason; delivered: number; attempted: number }> => {
    const result = (sent: boolean, reason: AlertReason, delivered = 0, attempted = 0) => ({ sent, reason, delivered, attempted });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("requests")
      .select("id, name, details, phone, requestType, status, latitude, longitude")
      .eq("id", data.requestId)
      .maybeSingle();
    if (error || !row) {
      console.error(`[whatsapp] Could not load request ${data.requestId}: ${error?.message ?? "not found"}`);
      return result(false, "not_found");
    }
    if (row.status === "confirmed") return result(true, "already_sent");
    if (row.status !== "pending") return result(false, "already_handled");

    const token = process.env["WHATSAPP_TOKEN"];
    const phoneNumberId = process.env["WHATSAPP_PHONE_NUMBER_ID"];
    if (!token || !phoneNumberId) {
      console.error(`[whatsapp] Not configured (WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID missing); request ${row.id} left pending`);
      return result(false, "not_configured");
    }

    const requestType: RequestType =
      row.requestType === "medical" || row.requestType === "groceries" || row.requestType === "callback" ? row.requestType : "medical";

    // Recipients: the list sent by the app (all family contacts, or the shop), else the row's phone.
    const realRecipients = [...new Set((data.recipients?.length ? data.recipients : [row.phone ?? ""]).map((p) => (p.trim() ? toE164(p) : "")))].filter(
      isValidE164,
    );
    if (!realRecipients.length) {
      console.error(`[whatsapp] Request ${row.id} has no valid phone number; left pending`);
      return result(false, "no_phone");
    }

    // Test mode: one message to the test number instead of the real contacts.
    // TWILIO_TEST_NUMBER is still honoured as a fallback for older setups.
    const testRaw = (process.env["WHATSAPP_TEST_NUMBER"] ?? process.env["TWILIO_TEST_NUMBER"])?.trim();
    const recipients = testRaw ? [toE164(testRaw)] : realRecipients;
    if (testRaw) console.log(`[whatsapp] Test mode: ${row.id} would go to ${realRecipients.join(", ")}`);

    const name = row.name?.trim() || "your family member";
    const details = row.details?.trim() || "";
    const elderPhone = data.elderPhone?.trim() ? toE164(data.elderPhone) : "";
    const mapLink =
      row.latitude != null && row.longitude != null ? `https://www.google.com/maps?q=${row.latitude},${row.longitude}` : "";

    const values: Record<RequestType, string[]> = {
      medical: [name, "Medical emergency", mapLink || "Location could not be captured", details || "Immediate assistance needed"],
      groceries: [name, details || "No items were captured", mapLink || "Location not shared", "Please call when you reach"],
      callback: [name, elderPhone || "Not provided", "Wants to speak to family", details || "Please call back"],
    };
    let text: Record<RequestType, string> = {
      medical: `Medical help is needed for ${name}.\n\nLocation: ${mapLink || "Location could not be captured."}\n\nDetails: ${details || "No details were captured."}`,
      groceries: `New grocery order for ${name}.\n\nOrder: ${details || "No items were captured."}${mapLink ? `\n\nLocation: ${mapLink}` : ""}`,
      callback: `${name} has asked for a call back.${elderPhone ? `\n\nCall: ${elderPhone}` : ""}${details ? `\n\nMessage: ${details}` : ""}`,
    };
    if (testRaw) {
      const tag = `[TEST MODE – would go to ${realRecipients.join(", ")}]\n\n`;
      text = { medical: tag + text.medical, groceries: tag + text.groceries, callback: tag + text.callback };
    }

    const template = TEMPLATES[requestType];
    let delivered = 0;
    for (const recipient of recipients) {
      const to = recipient.replace("+", "");
      const viaTemplate = await postToMeta(token, phoneNumberId, {
        to,
        type: "template",
        template: {
          name: template.name,
          language: { code: template.language },
          components: [{ type: "body", parameters: values[requestType].map((v) => ({ type: "text", text: param(v) })) }],
        },
      });
      if (viaTemplate.ok) {
        delivered += 1;
        continue;
      }
      console.error(`[whatsapp] Template "${template.name}" failed for ${row.id} ${viaTemplate.detail}; trying plain text`);
      const viaText = await postToMeta(token, phoneNumberId, { to, type: "text", text: { body: text[requestType] } });
      if (viaText.ok) delivered += 1;
      else console.error(`[whatsapp] Text fallback failed for ${row.id} ${viaText.detail}`);
    }

    if (!delivered) return result(false, "send_failed", 0, recipients.length);

    const { error: updateError } = await supabaseAdmin.from("requests").update({ status: "confirmed" }).eq("id", row.id);
    if (updateError) console.error(`[whatsapp] Sent, but could not mark ${row.id} confirmed: ${updateError.message}`);
    return result(true, "sent", delivered, recipients.length);
  });
