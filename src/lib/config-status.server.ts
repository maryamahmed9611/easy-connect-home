// Private configuration check. Runs on the server only and writes to the server logs
// (visible to project owners in Lovable), never to a web page or API response.
// It reports only WHETHER each secret is set — never a value, length or prefix.

const REQUIRED = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "WHATSAPP_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "SMALLEST_AI_API_KEY",
] as const;

const isSet = (name: string) => Boolean(process.env[name]?.trim());

async function checkWhatsAppToken(): Promise<string> {
  const token = process.env["WHATSAPP_TOKEN"];
  const phoneNumberId = process.env["WHATSAPP_PHONE_NUMBER_ID"];
  if (!token || !phoneNumberId) return "skipped (not configured)";
  try {
    // Read-only lookup of the sender number's id; sends no message.
    const response = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(phoneNumberId)}?fields=id`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) return "accepted by Meta";
    const payload = (await response.json().catch(() => null)) as { error?: { code?: number; error_subcode?: number } } | null;
    const code = payload?.error?.code;
    const sub = payload?.error?.error_subcode;
    const hint =
      code === 190 ? "token invalid or expired — use a permanent System User token" : code === 100 ? "phone number id not found for this token" : "see Meta error code";
    return `REJECTED by Meta [HTTP ${response.status}, code ${code ?? "?"}${sub ? `/${sub}` : ""}] – ${hint}`;
  } catch {
    return "could not reach Meta";
  }
}

export async function logConfigStatus(): Promise<void> {
  const lines = REQUIRED.map((name) => `  ${name}: ${isSet(name) ? "set" : "MISSING"}`);
  const testVar = isSet("WHATSAPP_TEST_NUMBER") ? "WHATSAPP_TEST_NUMBER" : isSet("TWILIO_TEST_NUMBER") ? "TWILIO_TEST_NUMBER" : null;
  lines.push(`  WhatsApp test mode: ${testVar ? `ON (via ${testVar}) – all alerts go to the test number` : "OFF – alerts go to real contacts"}`);
  const tokenStatus = await checkWhatsAppToken();
  lines.push(`  WhatsApp token check: ${tokenStatus}`);
  const token = process.env["WHATSAPP_TOKEN"];
  if (token && tokenStatus === "accepted by Meta") {
    const { resolveTemplates } = await import("./whatsapp-templates.server");
    const { templates, found } = await resolveTemplates(token);
    for (const kind of ["medical", "groceries", "callback"] as const) {
      lines.push(`  Template (${kind}): ${templates[kind].name} [${templates[kind].language}] ${found.includes(kind) ? "– found in Meta" : "– NOT found, using default name"}`);
    }
  }
  console.log(`[config-status]\n${lines.join("\n")}`);
}

let started = false;

// Runs at most once per server instance, without delaying the request that triggered it.
export function logConfigStatusOnce(ctx: unknown): void {
  if (started) return;
  started = true;
  const task = logConfigStatus().catch((error) => console.error("[config-status] check failed", error));
  const waitUntil = (ctx as { waitUntil?: (promise: Promise<unknown>) => void } | null)?.waitUntil;
  if (typeof waitUntil === "function") waitUntil.call(ctx, task);
}
