import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function toE164(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  return `+91${digits.replace(/^0/, "")}`;
}

// Sends the WhatsApp alert for a saved request in the background, then marks it confirmed.
export const sendWhatsAppAlert = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ requestId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
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
    if (row.status !== "pending") return { sent: false, reason: "already_handled" };

    const token = process.env["WHATSAPP_TOKEN"];
    const phoneNumberId = process.env["WHATSAPP_PHONE_NUMBER_ID"];
    let sent = false;
    let reason = "skipped_not_configured";

    if (token && phoneNumberId && row.phone) {
      const realTo = toE164(row.phone);
      const testRaw = process.env["TWILIO_TEST_NUMBER"]?.trim();
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

      const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
      });
      if (response.ok) {
        sent = true;
        reason = "sent";
      } else {
        console.error(`[whatsapp] Send failed for ${row.id} [${response.status}]: ${await response.text()}`);
        return { sent: false, reason: "send_failed" };
      }
    } else {
      console.log(`[whatsapp] WhatsApp not configured; skipping message for ${row.id}`);
    }

    const { error: updateError } = await supabaseAdmin.from("requests").update({ status: "confirmed" }).eq("id", row.id);
    if (updateError) console.error(`[whatsapp] Could not confirm ${row.id}: ${updateError.message}`);
    return { sent, reason };
  });
