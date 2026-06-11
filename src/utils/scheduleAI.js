import { supabase } from "../lib/supabase";
import { normaliseGroupOrder } from "./scheduleOrder.js";

/**
 * LLM fallback for the schedule-order parser. Only call this when the local
 * parser (parseGroupOrder) recognises no group in the user's text.
 *
 * Routes through the `parse-schedule-order` edge function so the Anthropic key
 * stays server-side. Returns a complete, normalised ordering of `available`.
 * Throws on transport/model error so the caller can show a fallback message —
 * notably when the edge function isn't deployed yet.
 *
 * @param {string} text         - the user's free-text requirement
 * @param {string[]} available  - group names present in the user's food list
 * @returns {Promise<string[]>} complete group ordering
 */
export async function parseGroupOrderWithAI(text, available) {
  const { data, error } = await supabase.functions.invoke("parse-schedule-order", {
    body: { text, groups: available },
  });
  if (error) throw new Error(error.message || "Edge Function error");
  if (!Array.isArray(data?.order)) throw new Error("No order returned from AI");
  return normaliseGroupOrder(data.order, available);
}
