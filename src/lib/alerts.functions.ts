import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function toE164(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  return `+91${digits.replace(/^0/, "")}`;
}

export type AlertReason =
  | "sent"
  | "already_sent"
  | "send_failed"
  | "not_configured"
  | "no_phone"
  | "not_found"
  | "already_handled";

// Sends the WhatsApp alert for a saved request, then marks it confirmed.
// The request is marked "confirmed" ONLY when Meta accepts the message; every other outcome leaves it "pending".
export const sendWhatsAppAlert = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ requestId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<{ sent: boolean; reason: AlertReason }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("requests")
      .select("id, name, details, phone, requestType, status, latitude, longitude")
      .eq("id", data.requestId)
      .maybeSingle();
    if (error || !row) {
      console.error(`[whatsapp] Could not load request ${data.requestId}: ${error?.message ?? "not found"}`);
      return { sent: false, reason: "not_found" };
    }
    if (row.status === "confirmed") return { sent: true, reason: "already_sent" };
    if (row.status !== "pending") return { sent: false, reason: "already_handled" };

    const token = process.env["WHATSAPP_TOKEN"];
    const phoneNumberId = process.env["WHATSAPP_PHONE_NUMBER_ID"];
    if (!token || !phoneNumberId) {
      console.error(`[whatsapp] Not configured (WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID missing); request ${row.id} left pending`);
      return { sent: false, reason: "not_configured" };
    }
    if (!row.phone) {
      console.error(`[whatsapp] Request ${row.id} has no phone number; left pending`);
      return { sent: false, reason: "no_phone" };
    }

    const realTo = toE164(row.phone);
    // Test mode: every alert goes to one number instead of the real contact.
    // TWILIO_TEST_NUMBER is still honoured only so existing setups keep their behaviour; remove it once
    // WHATSAPP_TEST_NUMBER is set (or remove both to turn test mode off).
    const testRaw = (process.env["WHATSAPP_TEST_NUMBER"] ?? process.env["TWILIO_TEST_NUMBER"])?.trim();
    const to = (testRaw ? toE164(testRaw) : realTo).replace("+", "");
    const name = row.name?.trim() || "your family member";
    const details = row.details?.trim() || "No details were captured.";
    let body =
      row.requestType === "medical"
        ? `Medical help is needed for ${name}.\n\nLocation: ${
            row.latitude != null && row.longitude != null
              ? `https://www.google.com/maps?q=${row.latitude},${row.longitude}`
              : "Location could not be captured."
          }\n\nDetails: ${details}`
        : `New grocery order for ${name}.\n\nOrder: ${details}`;
    if (testRaw) body = `[TEST MODE – would go to ${realTo}]\n\n${body}`;

    try {
      const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
      });
      if (!response.ok) {
        console.error(`[whatsapp] Send failed for ${row.id} [${response.status}]: ${await response.text()}`);
        return { sent: false, reason: "send_failed" };
      }
    } catch (sendError) {
      console.error(`[whatsapp] Send failed for ${row.id}: ${sendError instanceof Error ? sendError.message : "network error"}`);
      return { sent: false, reason: "send_failed" };
    }

    const { error: updateError } = await supabaseAdmin.from("requests").update({ status: "confirmed" }).eq("id", row.id);
    if (updateError) console.error(`[whatsapp] Sent, but could not mark ${row.id} confirmed: ${updateError.message}`);
    return { sent: true, reason: "sent" };
  });
