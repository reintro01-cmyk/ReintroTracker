// Edge Function — summarise an uploaded blood-work report with Claude (personal app only).
//
// Safety: the model EXPLAINS the report in plain language and flags out-of-range markers. It must
// NOT diagnose, prescribe, or give treatment advice — every summary ends by pointing the user back
// to their doctor. Patient lab data is sensitive; this runs only in the personal app, where the
// user is summarising their OWN report by their own choice.
//
// Setup: ANTHROPIC_API_KEY secret. Deploy: supabase functions deploy summarise-bloodwork

import Anthropic from "npm:@anthropic-ai/sdk@0.27.3";
import { createClient } from "npm:@supabase/supabase-js@2.106.2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const ALLOWED_MEDIA = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const MAX_B64 = 15_000_000; // ~10 MB decoded
const RATE_LIMIT_PER_HOUR = 20;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function enforceRateLimit(
  supabase: ReturnType<typeof createClient>, action: string, limit: number,
): Promise<Response | null> {
  const { data, error } = await supabase.rpc("record_ai_call", { p_action: action, p_limit: limit });
  if (error) { console.error("rate-limit check failed:", error); return jsonResponse({ error: "Rate limit check failed" }, 500); }
  const row = Array.isArray(data) ? data[0] : data;
  if (row && row.allowed === false) return jsonResponse({ error: "Rate limit exceeded — please try again later." }, 429);
  return null;
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

  const limited = await enforceRateLimit(supabase, "summarise-bloodwork", RATE_LIMIT_PER_HOUR);
  if (limited) return limited;

  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return jsonResponse({ error: "Invalid JSON body" }, 400); }
  const fileB64 = payload.file_base64;
  const mediaType = typeof payload.media_type === "string" ? payload.media_type : "";
  if (!ALLOWED_MEDIA.has(mediaType)) {
    return jsonResponse({ error: `media_type must be one of: ${[...ALLOWED_MEDIA].join(", ")}` }, 400);
  }
  if (typeof fileB64 !== "string" || fileB64.length < 100) return jsonResponse({ error: "file_base64 required" }, 400);
  if (fileB64.length > MAX_B64) return jsonResponse({ error: "File too large (max ~10 MB)" }, 413);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return jsonResponse({ error: "Server misconfigured (no model key)" }, 500);

  const prompt = `You are helping a layperson understand their own blood-work / lab report.
Read the attached report and produce a clear, calm, plain-language summary.

STRICT RULES:
- Do NOT diagnose, name conditions definitively, or recommend medications, doses, or treatments.
- Explain what the main markers mean in everyday language.
- Identify values that appear OUTSIDE the report's stated reference range, with the value and the range.
- Be reassuring and factual; avoid alarming language. If something looks notable, say it's worth
  discussing with their doctor — never tell them what it means medically.
- If the image/PDF is not a lab report or is unreadable, say so and return empty flags.

Return ONLY valid JSON (no markdown):
{
  "summary": "2-5 short paragraphs in plain language, ending with a line advising they review results with their doctor.",
  "flags": [ { "label": "marker name", "value": "measured value + unit", "note": "high/low vs the report's range, in plain words" } ]
}`;

  const fileBlock = mediaType === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: mediaType, data: fileB64 } }
    : { type: "image", source: { type: "base64", media_type: mediaType, data: fileB64 } };

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content: [fileBlock as never, { type: "text", text: prompt }] }],
    });

    const textBlock = (message.content as Array<{ type: string; text?: string }>).find(b => b.type === "text" && b.text);
    if (!textBlock?.text) return jsonResponse({ error: "Model returned no text" }, 502);
    const match = textBlock.text.trim().match(/\{[\s\S]*\}/);
    if (!match) return jsonResponse({ error: "No JSON in model response" }, 502);

    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(match[0]); } catch { return jsonResponse({ error: "Malformed JSON from model" }, 502); }

    const summary = typeof parsed.summary === "string" ? parsed.summary.slice(0, 4000) : "";
    const flags = Array.isArray(parsed.flags)
      ? parsed.flags.slice(0, 30).map((f) => {
          const o = (f && typeof f === "object") ? f as Record<string, unknown> : {};
          return {
            label: typeof o.label === "string" ? o.label.slice(0, 80) : "",
            value: typeof o.value === "string" ? o.value.slice(0, 80) : "",
            note: typeof o.note === "string" ? o.note.slice(0, 200) : "",
          };
        }).filter((f) => f.label)
      : [];

    if (!summary) return jsonResponse({ error: "Could not read the report" }, 422);
    return jsonResponse({ summary, flags });
  } catch (err) {
    console.error("summarise-bloodwork failed:", err);
    return jsonResponse({ error: "Could not summarise the report. Please try again." }, 500);
  }
});
