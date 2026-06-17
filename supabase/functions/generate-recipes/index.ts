// Supabase Edge Function — generate recipes with Claude
//
// Setup (one-time):
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase functions deploy generate-recipes
//
// Also check supabase/config.toml — `[functions.generate-recipes] verify_jwt = true`
// gives a first line of defence at the gateway. We additionally verify the JWT
// here so we have a known user_id for rate-limit / abuse tracking.
//
// Deno runtime — imports use npm: specifier

import Anthropic from "npm:@anthropic-ai/sdk@0.27.3";
import { createClient } from "npm:@supabase/supabase-js@2.106.2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DETOX_RULES = `
DETOX PHASE — only these ingredients are permitted:
• Protein:    egg whites (4 numbers) OR whey protein (1 scoop / 30 g in 200 ml water)
• Fat:        ghee OR virgin coconut oil (max 1 tbsp total)
• Vegetables: avocado, French beans, beetroot, broccoli, cabbage, carrot, cauliflower,
              celery, cucumber, garlic, ginger, palak/spinach, lemon, lettuce, mint,
              onions, white pumpkin, zucchini
• Seasonings: salt, pepper, apple cider vinegar, coriander powder, garam masala,
              jeera powder, sauf powder, chat masala, amchur powder, lemon juice
• Drinks:     black coffee, green tea, plain water
No oil for cooking — dry-cook or steam only.`;

// ── Input bounds ─────────────────────────────────────────────────────────────
const MAX_SAFE_FOODS = 60;
const MAX_STR_LEN = 80;
const VALID_PHASES = new Set(["detox", "reintro", "pre"]);
const VALID_SLOT_TYPES = new Set(["fat", "protein", "vegcarb", "fibre", "proteincarb"]);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// Per-user hourly cap. Calls the record_ai_call RPC (SECURITY DEFINER, counts in Postgres so it
// holds across edge instances). Returns a 429 Response when the user is over the limit, else null.
async function enforceRateLimit(
  supabase: ReturnType<typeof createClient>,
  action: string,
  limit: number,
): Promise<Response | null> {
  const { data, error } = await supabase.rpc("record_ai_call", { p_action: action, p_limit: limit });
  if (error) { console.error("rate-limit check failed:", error); return jsonResponse({ error: "Rate limit check failed" }, 500); }
  const row = Array.isArray(data) ? data[0] : data;
  if (row && row.allowed === false) {
    return jsonResponse({ error: "Rate limit exceeded — please try again later." }, 429);
  }
  return null;
}

const RATE_LIMIT_PER_HOUR = 40;

function isShortString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= MAX_STR_LEN;
}

function isKcal(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 30 && v <= 1500;
}

function isPercent(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100;
}

function validatePayload(p: Record<string, unknown>): { ok: true } | { ok: false; error: string } {
  if (!isShortString(p.slotLabel)) return { ok: false, error: "slotLabel must be a non-empty string ≤ 80 chars" };
  if (!isShortString(p.slotTime))  return { ok: false, error: "slotTime must be a non-empty string ≤ 80 chars" };
  if (typeof p.slotType !== "string" || !VALID_SLOT_TYPES.has(p.slotType)) {
    return { ok: false, error: "slotType must be one of: fat, protein, vegcarb, fibre, proteincarb" };
  }
  if (typeof p.phase !== "string" || !VALID_PHASES.has(p.phase)) {
    return { ok: false, error: "phase must be one of: detox, reintro, pre" };
  }
  if (!Array.isArray(p.safeFoods)) return { ok: false, error: "safeFoods must be an array" };
  if (p.safeFoods.length > MAX_SAFE_FOODS) return { ok: false, error: `safeFoods length must be ≤ ${MAX_SAFE_FOODS}` };
  if (!p.safeFoods.every((s: unknown) => isShortString(s))) {
    return { ok: false, error: "safeFoods entries must be non-empty strings ≤ 80 chars" };
  }
  if (!isKcal(p.slotKcal)) return { ok: false, error: "slotKcal must be a number 30–1500" };

  const m = p.macros as Record<string, unknown> | null;
  if (!m || typeof m !== "object") return { ok: false, error: "macros must be an object" };
  for (const k of ["fat", "carbs", "protein", "fibre"]) {
    if (!isPercent(m[k])) return { ok: false, error: `macros.${k} must be a number 0–100` };
  }
  return { ok: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  // ── Auth ─────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "Missing Authorization header" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) return jsonResponse({ error: "Server misconfigured" }, 500);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) return jsonResponse({ error: "Unauthorized" }, 401);

  // ── Rate limit ─────────────────────────────────────────────────────────────
  const limited = await enforceRateLimit(supabase, "generate-recipes", RATE_LIMIT_PER_HOUR);
  if (limited) return limited;

  // ── Parse + validate ─────────────────────────────────────────────────────
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const check = validatePayload(payload);
  if (!check.ok) return jsonResponse({ error: check.error }, 400);

  const {
    slotLabel,
    slotTime,
    slotType,
    phase,
    safeFoods,
    slotKcal,
    macros,
  } = payload as {
    slotLabel: string; slotTime: string; slotType: string; phase: string;
    safeFoods: string[]; slotKcal: number;
    macros: { fat: number; carbs: number; protein: number; fibre: number };
  };

  const isDetox = phase === "detox" || phase === "pre";
  const safeList = safeFoods.length ? safeFoods.join(", ") : "none yet";

  const restrictions = isDetox
    ? DETOX_RULES
    : `REINTRODUCTION PHASE — cleared safe foods available: ${safeList}
Base detox vegetables and seasonings are also still allowed.
No oil needed; if a recipe benefits from fat use ghee or coconut oil (max 1 tsp).`;

  const prompt = `You are a clinical nutritionist specialising in elimination and reintroduction diets.
Generate 3 varied, creative, practical meal ideas for an Indian patient.

SLOT: ${slotLabel} (${slotTime})
PHASE: ${isDetox ? "Detox (strict)" : "Reintroduction"}
CALORIE BUDGET: ~${slotKcal} kcal — stay within ±18%
MACRO TARGETS: Fat ${macros.fat}% · Carbs ${macros.carbs}% · Protein ${macros.protein}% · Fibre ${macros.fibre}%

${restrictions}

Rules:
- Preparation under 20 minutes
- Suitable for an Indian palate and kitchen
- No added sugar; no deep frying
- Each recipe must be genuinely different from the others
- Gram weights must be realistic

Return ONLY valid JSON — no markdown, no extra text:
{
  "recipes": [
    {
      "name": "Recipe Name",
      "kcal": 90,
      "prepMins": 8,
      "macros": { "fat": 1, "carbs": 3, "protein": 20, "fibre": 2 },
      "ingredients": [{ "name": "ingredient", "qty": "amount with unit" }],
      "method": "Step-by-step preparation in 2–4 sentences.",
      "tags": ["tag1", "tag2"]
    }
  ]
}`;

  // ── Claude call ──────────────────────────────────────────────────────────
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return jsonResponse({ error: "Server misconfigured (no model key)" }, 500);

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2200,
      messages: [{ role: "user", content: prompt }],
    });

    // Find the first text block (defensive: future model variants may emit
    // thinking / tool_use blocks ahead of the text response).
    const textBlock = (message.content as Array<{ type: string; text?: string }>)
      .find(b => b.type === "text" && typeof b.text === "string");
    if (!textBlock?.text) return jsonResponse({ error: "Model returned no text content" }, 502);

    const raw = textBlock.text.trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return jsonResponse({ error: "Model response contained no JSON" }, 502);

    let parsed: { recipes?: unknown };
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return jsonResponse({ error: "Model returned malformed JSON" }, 502);
    }
    if (!parsed || !Array.isArray(parsed.recipes)) {
      return jsonResponse({ error: "Model response missing 'recipes' array" }, 502);
    }

    const result = parsed.recipes.map((r: unknown, i: number) => {
      const recipe = (r && typeof r === "object") ? r as Record<string, unknown> : {};
      return {
        ...recipe,
        id: `ai-${userData.user.id.slice(0, 8)}-${Date.now()}-${i}`,
        slot: slotType,
        phase: "both",
        requiredSafeFoods: [],
        generated: true,
      };
    });

    return jsonResponse({ recipes: result });
  } catch (err) {
    console.error("generate-recipes failed:", err);
    return jsonResponse({ error: "Recipe generation failed. Please try again." }, 500);
  }
});
