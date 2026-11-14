// Finds the approved WhatsApp templates for each request type by asking Meta, so the app does not
// depend on typing the exact template names. A template is matched by its name OR its text
// (e.g. "ELDERLY CARE ALERT"). Server-only; results are cached per server instance.

export type TemplateKind = "medical" | "groceries" | "callback";
export type TemplateRef = { name: string; language: string };

const GRAPH = "https://graph.facebook.com/v21.0";

// Used when the lookup fails. Best guesses from WhatsApp Manager.
const FALLBACK: Record<TemplateKind, TemplateRef> = {
  medical: { name: "elderly_assistance_alert", language: "en" },
  groceries: { name: "grocery_request_alert", language: "en" },
  callback: { name: "call_assistsance_request", language: "en" },
};

const MATCHERS: Record<TemplateKind, { namePrefixes: string[]; textIncludes: string[] }> = {
  medical: { namePrefixes: ["elderly_assist", "elderly_care", "medical"], textIncludes: ["ELDERLY CARE ALERT"] },
  groceries: { namePrefixes: ["grocery"], textIncludes: ["GROCERY REQUEST"] },
  callback: { namePrefixes: ["call_assis", "call_request", "callback"], textIncludes: ["CALL ASSISTANCE"] },
};

type MetaTemplate = { name: string; status: string; language: string; components?: Array<{ text?: string }> };

async function getJson<T>(url: string, token: string): Promise<T | null> {
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      console.error(`[whatsapp-templates] Lookup failed [${response.status}]: ${(await response.text()).slice(0, 200)}`);
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function lookup(token: string): Promise<{ templates: Record<TemplateKind, TemplateRef>; found: TemplateKind[] }> {
  // The token's WhatsApp Business Account id(s) come from Meta's token debugger.
  const debug = await getJson<{ data?: { granular_scopes?: Array<{ scope: string; target_ids?: string[] }> } }>(
    `${GRAPH}/debug_token?input_token=${encodeURIComponent(token)}`,
    token,
  );
  const wabaIds = [
    ...new Set(
      (debug?.data?.granular_scopes ?? [])
        .filter((s) => s.scope.startsWith("whatsapp_business"))
        .flatMap((s) => s.target_ids ?? []),
    ),
  ];

  const all: MetaTemplate[] = [];
  for (const id of wabaIds) {
    const page = await getJson<{ data?: MetaTemplate[] }>(
      `${GRAPH}/${encodeURIComponent(id)}/message_templates?fields=name,status,language,components&limit=100`,
      token,
    );
    all.push(...(page?.data ?? []));
  }
  const approved = all.filter((t) => t.status === "APPROVED");

  const templates = { ...FALLBACK };
  const found: TemplateKind[] = [];
  for (const kind of Object.keys(MATCHERS) as TemplateKind[]) {
    const { namePrefixes, textIncludes } = MATCHERS[kind];
    const match = approved.find((t) => {
      const text = (t.components ?? []).map((c) => c.text ?? "").join(" ").toUpperCase();
      return namePrefixes.some((p) => t.name.startsWith(p)) || textIncludes.some((w) => text.includes(w));
    });
    if (match) {
      templates[kind] = { name: match.name, language: match.language };
      found.push(kind);
    }
  }
  return { templates, found };
}

let cached: Promise<{ templates: Record<TemplateKind, TemplateRef>; found: TemplateKind[] }> | null = null;

export function resolveTemplates(token: string) {
  if (!cached) {
    cached = lookup(token).then((result) => {
      // Retry on the next alert if nothing was found (e.g. Meta was briefly unreachable).
      if (!result.found.length) cached = null;
      return result;
    });
  }
  return cached;
}
