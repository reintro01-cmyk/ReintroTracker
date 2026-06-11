import { supabase } from "../lib/supabase";
import { parseRecipeLocal } from "./recipeParseLocal.js";

/**
 * Phase 4 — turn free recipe text into structured line items
 * { servings, lines: [{ raw_text, qty, unit, ingredient_guess }] }.
 *
 * The model ONLY parses (qty/unit/ingredient_guess); nutrition is computed downstream by
 * resolving each line via search_foods + measures, then computeLogMacros — never by the LLM.
 *
 * Primary path is the `parse-recipe` edge function (Claude). If it's unreachable (not
 * deployed, offline, rate-limited), we fall back to the local regex parser so the flow still
 * works, and tag the result with `source: 'local'` so the UI can hint at degraded quality.
 */
export async function parseRecipeText(text) {
  try {
    const { data, error } = await supabase.functions.invoke("parse-recipe", { body: { text } });
    if (error) throw new Error(error.message || "Edge Function error");
    if (!Array.isArray(data?.lines)) throw new Error("No lines returned from parser");
    return { servings: data.servings || 1, lines: data.lines, source: "llm" };
  } catch {
    const local = parseRecipeLocal(text);
    return { ...local, source: "local" };
  }
}
