import { supabase } from "../lib/supabase";
import { edgeErrorMessage } from "./edgeError.js";

/**
 * Call the Supabase Edge Function to generate AI recipes for a single meal slot.
 * Returns an array of recipe objects (each has `generated: true`).
 *
 * @param {object} params
 * @param {string} params.slotLabel    - e.g. "Fat Meal"
 * @param {string} params.slotTime     - e.g. "8:00 AM"
 * @param {string} params.slotType     - "fat" | "protein" | "vegcarb" | "fibre"
 * @param {string} params.phase        - "detox" | "reintro" | "pre"
 * @param {string[]} params.safeFoods  - food names that are cleared Safe
 * @param {number} params.slotKcal     - calorie budget for this slot
 * @param {object} params.macros       - { fat, carbs, protein, fibre } percentages
 */
export async function generateRecipesForSlot({
  slotLabel,
  slotTime,
  slotType,
  phase,
  safeFoods,
  slotKcal,
  macros,
}) {
  const { data, error } = await supabase.functions.invoke("generate-recipes", {
    body: { slotLabel, slotTime, slotType, phase, safeFoods, slotKcal, macros },
  });

  if (error) throw new Error(await edgeErrorMessage(error));
  if (!Array.isArray(data?.recipes)) throw new Error("No recipes returned from AI");
  return data.recipes;
}
