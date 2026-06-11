// Edge Function — extract FACTS from a recipe-card image with Claude vision.
//
// Copyright-safe by design: we extract only the uncopyrightable facts (dish name, ingredient
// list + quantities, servings). We deliberately DO NOT copy the card's method/instruction prose
// or marketing copy — nutrition is recomputed downstream from our own food DB, and method text
// is rewritten separately. The source image is used only as an OCR source, never stored or shipped.
//
// Setup: ANTHROPIC_API_KEY secret (already set). Deploy: supabase functions deploy extract-recipe-image

import Anthropic from "npm:@anthropic-ai/sdk@0.27.3";
import { createClient } from "npm:@supabase/supabase-js@2.106.2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const ALLOWED_UNITS = new Set(["g", "ml", "tsp", "tbsp", "cup", "katori", "bowl", "glass", "piece", "slice", "handful", "plate", "pinch"]);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "Missing Authorization header" }, 401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) return jsonResponse({ error: "Server misconfigured" }, 500);
  const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) return jsonResponse({ error: "Unauthorized" }, 401);

  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return jsonResponse({ error: "Invalid JSON body" }, 400); }
  const imageB64 = payload.image_base64;
  const mediaType = (typeof payload.media_type === "string" ? payload.media_type : "image/jpeg");
  if (typeof imageB64 !== "string" || imageB64.length < 100) {
    return jsonResponse({ error: "image_base64 required" }, 400);
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return jsonResponse({ error: "Server misconfigured (no model key)" }, 500);

  const prompt = `This image is a recipe card. Extract ONLY the factual data. Do NOT transcribe or
paraphrase the cooking method / instructions paragraph — ignore it entirely.

Return ONLY valid JSON (no markdown, no commentary):
{
  "name": "the dish name",
  "servings": <integer, default 1>,
  "ingredients": [
    { "name": "clean ingredient name, no brand/adjectives", "qty": <number or null>, "unit": "<one of: g, ml, tsp, tbsp, cup, katori, bowl, glass, piece, slice, handful, plate, pinch, or null>" }
  ],
  "health_tags": ["short", "keywords", "from the subtitle if any (e.g. protein rich, high fiber)"],
  "stated_kcal": <the kcal number shown on the card, or null>
}
Convert quantities to those units (e.g. "2 tbs"->unit "tbsp"; "1.5 cups"->qty 1.5 unit "cup").
If a weight/volume is given in grams or ml, use that. Use null qty for "to taste" items.`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1200,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageB64 } },
          { type: "text", text: prompt },
        ],
      }],
    });

    const textBlock = (message.content as Array<{ type: string; text?: string }>).find(b => b.type === "text" && b.text);
    if (!textBlock?.text) return jsonResponse({ error: "Model returned no text" }, 502);
    const match = textBlock.text.trim().match(/\{[\s\S]*\}/);
    if (!match) return jsonResponse({ error: "No JSON in model response" }, 502);

    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(match[0]); } catch { return jsonResponse({ error: "Malformed JSON from model" }, 502); }

    const name = typeof parsed.name === "string" ? parsed.name.slice(0, 120) : "";
    const servings = Number.isFinite(Number(parsed.servings)) && Number(parsed.servings) > 0 ? Math.min(50, Math.round(Number(parsed.servings))) : 1;
    const ingredients = Array.isArray(parsed.ingredients) ? parsed.ingredients.slice(0, 40).map((l) => {
      const o = (l && typeof l === "object") ? l as Record<string, unknown> : {};
      const qtyNum = Number(o.qty);
      const unit = typeof o.unit === "string" && ALLOWED_UNITS.has(o.unit) ? o.unit : null;
      return {
        name: typeof o.name === "string" ? o.name.slice(0, 100) : "",
        qty: Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : null,
        unit,
      };
    }).filter((l) => l.name.length > 0) : [];
    const health_tags = Array.isArray(parsed.health_tags) ? parsed.health_tags.filter((t) => typeof t === "string").slice(0, 6) : [];
    const stated_kcal = Number.isFinite(Number(parsed.stated_kcal)) ? Number(parsed.stated_kcal) : null;

    if (!name || ingredients.length === 0) return jsonResponse({ error: "Could not extract a recipe", name, ingredients }, 422);
    return jsonResponse({ name, servings, ingredients, health_tags, stated_kcal });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
