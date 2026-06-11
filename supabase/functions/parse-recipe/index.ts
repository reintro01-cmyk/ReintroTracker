// Supabase Edge Function — parse a free-text recipe into STRUCTURED LINE ITEMS with Claude.
//
// HARD INVARIANT: the model ONLY parses text into {qty, unit, ingredient_guess}. It must
// NEVER output calories or macros. All nutrition is computed downstream from our ingredient
// tables (search_foods -> measures -> grams -> per-100g). This is what makes recipe nutrition
// trustworthy and non-hallucinated.
//
// Setup (one-time):
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase functions deploy parse-recipe
//
// Deno runtime — imports use npm: specifier.

import Anthropic from "npm:@anthropic-ai/sdk@0.27.3";
import { createClient } from "npm:@supabase/supabase-js@2.106.2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_TEXT_LEN = 4000;
const MAX_LINES = 60;
const ALLOWED_UNITS = new Set(["g", "ml", "tsp", "tbsp", "cup", "katori", "bowl", "glass", "piece", "slice", "handful", "plate"]);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // ── Auth ─────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "Missing Authorization header" }, 401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) return jsonResponse({ error: "Server misconfigured" }, 500);
  const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) return jsonResponse({ error: "Unauthorized" }, 401);

  // ── Parse + validate input ─────────────────────────────────────────────────
  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return jsonResponse({ error: "Invalid JSON body" }, 400); }
  const text = payload.text;
  if (typeof text !== "string" || text.trim().length === 0 || text.length > MAX_TEXT_LEN) {
    return jsonResponse({ error: `text must be a non-empty string ≤ ${MAX_TEXT_LEN} chars` }, 400);
  }

  const prompt = `You convert a free-text recipe into structured ingredient line items for a
nutrition app. You DO NOT calculate or output nutrition — no calories, no macros, ever.
Nutrition is computed elsewhere from a verified database.

RECIPE:
"""${text}"""

For each ingredient line, extract:
- raw_text: the original line, trimmed
- qty: the numeric quantity (convert fractions/words to decimals; null if none given)
- unit: ONE of [${[...ALLOWED_UNITS].join(", ")}] — pick the closest; use "piece" for
  countable items (1 egg, 2 idli), "g"/"ml" when a weight/volume is stated; null if truly unknown
- ingredient_guess: a short, clean, searchable food name (e.g. "paneer", "basmati rice",
  "ghee") — strip brands, adjectives like "fresh/chopped", and preparation notes

Also extract "servings" (integer the recipe yields; default 1 if not stated).
Ignore non-ingredient lines (steps, headings, garnish-to-taste with no quantity is still an
ingredient with qty null).

Return ONLY valid JSON, no markdown, no commentary, no nutrition fields:
{
  "servings": 1,
  "lines": [
    { "raw_text": "2 cups basmati rice", "qty": 2, "unit": "cup", "ingredient_guess": "basmati rice" }
  ]
}`;

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return jsonResponse({ error: "Server misconfigured (no model key)" }, 500);

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1800,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = (message.content as Array<{ type: string; text?: string }>)
      .find(b => b.type === "text" && typeof b.text === "string");
    if (!textBlock?.text) return jsonResponse({ error: "Model returned no text content" }, 502);
    const match = textBlock.text.trim().match(/\{[\s\S]*\}/);
    if (!match) return jsonResponse({ error: "Model response contained no JSON" }, 502);

    let parsed: { servings?: unknown; lines?: unknown };
    try { parsed = JSON.parse(match[0]); } catch { return jsonResponse({ error: "Model returned malformed JSON" }, 502); }
    if (!parsed || !Array.isArray(parsed.lines)) return jsonResponse({ error: "Model response missing 'lines' array" }, 502);

    // Sanitize: enforce shape, strip any nutrition the model may have slipped in.
    const servings = Number.isFinite(Number(parsed.servings)) && Number(parsed.servings) > 0
      ? Math.min(50, Math.round(Number(parsed.servings))) : 1;
    const lines = (parsed.lines as unknown[]).slice(0, MAX_LINES).map((l) => {
      const o = (l && typeof l === "object") ? l as Record<string, unknown> : {};
      const qtyNum = Number(o.qty);
      const unit = typeof o.unit === "string" && ALLOWED_UNITS.has(o.unit) ? o.unit : null;
      return {
        raw_text: typeof o.raw_text === "string" ? o.raw_text.slice(0, 200) : "",
        qty: Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : null,
        unit,
        ingredient_guess: typeof o.ingredient_guess === "string" ? o.ingredient_guess.slice(0, 120) : "",
      };
    }).filter(l => l.ingredient_guess.length > 0);

    return jsonResponse({ servings, lines });
  } catch (err) {
    const messageText = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: messageText }, 500);
  }
});
