// Supabase Edge Function — parse a free-text reintroduction-order request into a
// group ordering, using Claude. This is the FALLBACK for the client-side parser
// (src/utils/scheduleOrder.js); it's only called when the local parser recognises
// no group, so traffic here is low.
//
// Setup (one-time):
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase functions deploy parse-schedule-order
//
// Deno runtime — imports use npm: specifier.

import Anthropic from "npm:@anthropic-ai/sdk@0.27.3";
import { createClient } from "npm:@supabase/supabase-js@2.106.2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_TEXT_LEN = 400;
const MAX_GROUPS = 40;
const MAX_GROUP_LEN = 60;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

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

  // ── Parse + validate ───────────────────────────────────────────────────────
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const text = payload.text;
  const groups = payload.groups;
  if (typeof text !== "string" || text.length === 0 || text.length > MAX_TEXT_LEN) {
    return jsonResponse({ error: `text must be a non-empty string ≤ ${MAX_TEXT_LEN} chars` }, 400);
  }
  if (!Array.isArray(groups) || groups.length === 0 || groups.length > MAX_GROUPS) {
    return jsonResponse({ error: `groups must be a non-empty array ≤ ${MAX_GROUPS}` }, 400);
  }
  if (!groups.every(g => typeof g === "string" && g.length > 0 && g.length <= MAX_GROUP_LEN)) {
    return jsonResponse({ error: "groups entries must be non-empty strings" }, 400);
  }

  const groupList = (groups as string[]).join("\n- ");
  const prompt = `You arrange food groups into a reintroduction order for an elimination-diet app.

The user wants to reorder their food reintroduction schedule. Here is their request:
"""${text}"""

These are the ONLY valid food groups (use these exact strings):
- ${groupList}

Return the groups ordered to best satisfy the request (earliest = reintroduced first).
Include every group exactly once. If the request only cares about some groups, put
those where the user wants and leave the rest in their original relative order.

Return ONLY valid JSON, no markdown, no commentary:
{ "order": ["Group A", "Group B", ...] }`;

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return jsonResponse({ error: "Server misconfigured (no model key)" }, 500);

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = (message.content as Array<{ type: string; text?: string }>)
      .find(b => b.type === "text" && typeof b.text === "string");
    if (!textBlock?.text) return jsonResponse({ error: "Model returned no text content" }, 502);

    const match = textBlock.text.trim().match(/\{[\s\S]*\}/);
    if (!match) return jsonResponse({ error: "Model response contained no JSON" }, 502);

    let parsed: { order?: unknown };
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return jsonResponse({ error: "Model returned malformed JSON" }, 502);
    }
    if (!parsed || !Array.isArray(parsed.order)) {
      return jsonResponse({ error: "Model response missing 'order' array" }, 502);
    }

    // Defensive: keep only valid known groups (client re-normalises too).
    const allowed = new Set(groups as string[]);
    const order = parsed.order.filter((g: unknown): g is string => typeof g === "string" && allowed.has(g));

    return jsonResponse({ order });
  } catch (err) {
    const messageText = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: messageText }, 500);
  }
});
