import { useState, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { parseRecipeText } from "../utils/recipeParse.js";
import { unitToGrams, computeRecipeTotals } from "../utils/recipeResolve.js";
import { num } from "../utils/foodLog.js";

const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));

// Phase 4 — drive the "add recipe from text" flow. Parses free text (LLM edge fn, local
// fallback), resolves every line against search_foods + measures into grams, lets the user
// fix matches/grams, then persists a draft recipe (recipes + recipe_ingredients +
// recipe_nutrition). Nutrition is always computed from our tables, never from the model.
//
// `search`, `fetchMeasures`, `units` are injected from useFoodLog so there's one data layer.
export function useRecipeBuilder({ session, country = "india", search, fetchMeasures, units = [] }) {
  const userId = session?.user?.id || null;
  const unitMap = useMemo(() => Object.fromEntries((units || []).map(u => [u.unit, num(u.grams)])), [units]);

  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [servings, setServings] = useState(1);
  const [lines, setLines] = useState([]);
  const [parseSource, setParseSource] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const resolveParsed = useCallback(async (p) => {
    const candidates = await search(p.ingredient_guess, country).catch(() => []);
    const matchIndex = candidates.length ? 0 : -1;
    const food = matchIndex >= 0 ? candidates[0] : null;
    const measures = food ? await fetchMeasures(food.ingredient_id) : [];
    const { grams, basis } = unitToGrams(p.qty, p.unit, measures, unitMap);
    return {
      id: uid(), raw_text: p.raw_text, qty: p.qty, unit: p.unit, ingredient_guess: p.ingredient_guess,
      candidates, matchIndex, measures, grams, gramsBasis: basis, manualGrams: false,
    };
  }, [search, fetchMeasures, country, unitMap]);

  const parse = useCallback(async () => {
    if (!text.trim()) return;
    setParsing(true); setError("");
    try {
      const res = await parseRecipeText(text);
      setParseSource(res.source);
      setServings(res.servings || 1);
      const resolved = await Promise.all((res.lines || []).map(resolveParsed));
      setLines(resolved);
      if (!name.trim() && resolved.length) {
        const head = resolved.slice(0, 3).map(l => l.ingredient_guess).filter(Boolean);
        setName(head.join(", ").slice(0, 60));
      }
    } catch (e) {
      setError(e.message || "Could not parse recipe");
    } finally {
      setParsing(false);
    }
  }, [text, name, resolveParsed]);

  const recompute = useCallback((line, patch) => {
    const next = { ...line, ...patch };
    if (!next.manualGrams) {
      const food = next.matchIndex >= 0 ? next.candidates[next.matchIndex] : null;
      const { grams, basis } = unitToGrams(next.qty, next.unit, food ? next.measures : [], unitMap);
      next.grams = grams; next.gramsBasis = basis;
    }
    return next;
  }, [unitMap]);

  const setMatch = useCallback(async (id, matchIndex) => {
    const line = lines.find(l => l.id === id);
    if (!line) return;
    const food = matchIndex >= 0 ? line.candidates[matchIndex] : null;
    const measures = food ? await fetchMeasures(food.ingredient_id) : [];
    setLines(ls => ls.map(l => l.id === id ? recompute(l, { matchIndex, measures }) : l));
  }, [lines, fetchMeasures, recompute]);

  const setLineQtyUnit = useCallback((id, patch) => {
    setLines(ls => ls.map(l => l.id === id ? recompute(l, patch) : l));
  }, [recompute]);

  // Re-run search for a line with a user-edited term (the way to fix an unmatched/wrong line).
  const researchLine = useCallback(async (id, term) => {
    const candidates = await search(term, country).catch(() => []);
    const matchIndex = candidates.length ? 0 : -1;
    const food = matchIndex >= 0 ? candidates[0] : null;
    const measures = food ? await fetchMeasures(food.ingredient_id) : [];
    setLines(ls => ls.map(l => l.id === id
      ? recompute({ ...l, ingredient_guess: term, candidates, measures }, { matchIndex })
      : l));
  }, [search, fetchMeasures, country, recompute]);

  const setLineGrams = useCallback((id, grams) => {
    setLines(ls => ls.map(l => l.id === id ? { ...l, grams: num(grams) || null, gramsBasis: "manual", manualGrams: true } : l));
  }, []);

  const removeLine = useCallback((id) => setLines(ls => ls.filter(l => l.id !== id)), []);

  const totals = useMemo(
    () => computeRecipeTotals(lines.map(l => ({ food: l.matchIndex >= 0 ? l.candidates[l.matchIndex] : null, grams: l.grams })), servings),
    [lines, servings]
  );

  const totalGrams = useMemo(() => lines.reduce((a, l) => a + (num(l.grams) || 0), 0), [lines]);

  // Persist a draft recipe owned by the user. Returns the new recipe id + per-serving macros.
  const save = useCallback(async () => {
    if (!userId) return { error: "Not signed in" };
    if (!lines.length) return { error: "Nothing to save" };
    setSaving(true); setError("");
    try {
      const slug = `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      const recipeName = (name.trim() || "My recipe").slice(0, 120);
      const { data: rec, error: recErr } = await supabase
        .from("recipes")
        .insert({ slug, name: recipeName, servings: num(servings) || 1, source_id: "USER", status: "draft", created_by: userId })
        .select("id").single();
      if (recErr) throw new Error(recErr.message);
      const recipeId = rec.id;

      // map matched ingredient_id -> a state id (prefer raw) for the FK
      const matchedIds = lines.filter(l => l.matchIndex >= 0).map(l => l.candidates[l.matchIndex].ingredient_id);
      const stateByIngredient = {};
      if (matchedIds.length) {
        const { data: states } = await supabase
          .from("ingredient_states").select("id,ingredient_id,state").in("ingredient_id", matchedIds);
        for (const s of states || []) {
          if (!stateByIngredient[s.ingredient_id] || s.state === "raw") stateByIngredient[s.ingredient_id] = s.id;
        }
      }

      const ingRows = lines.map((l, i) => {
        const food = l.matchIndex >= 0 ? l.candidates[l.matchIndex] : null;
        return {
          recipe_id: recipeId,
          ingredient_state_id: food ? (stateByIngredient[food.ingredient_id] || null) : null,
          raw_text: l.raw_text || l.ingredient_guess,
          qty: l.qty, unit: l.unit, grams_resolved: l.grams,
          match_confidence: food ? (food.confidence || "medium") : "unmatched",
          position: i,
          notes: food ? `matched: ${food.name}` : `unmatched: ${l.ingredient_guess}`,
        };
      });
      const { error: ingErr } = await supabase.from("recipe_ingredients").insert(ingRows);
      if (ingErr) throw new Error(ingErr.message);

      const nutRows = [
        { recipe_id: recipeId, per: "serving", energy_kcal: totals.perServing.kcal, protein_g: totals.perServing.protein_g, fat_g: totals.perServing.fat_g, carb_avail_g: totals.perServing.carb_g, fibre_g: totals.perServing.fibre_g, flags: totals.flags, method_version: `llm-parse-v1/${parseSource || "?"}` },
        { recipe_id: recipeId, per: "recipe", energy_kcal: totals.total.kcal, protein_g: totals.total.protein_g, fat_g: totals.total.fat_g, carb_avail_g: totals.total.carb_g, fibre_g: totals.total.fibre_g, flags: totals.flags, method_version: `llm-parse-v1/${parseSource || "?"}` },
      ];
      const { error: nutErr } = await supabase.from("recipe_nutrition").insert(nutRows);
      if (nutErr) throw new Error(nutErr.message);

      return { recipeId, name: recipeName, perServing: totals.perServing, perServingGrams: totalGrams / (num(servings) || 1) };
    } catch (e) {
      setError(e.message || "Save failed");
      return { error: e.message };
    } finally {
      setSaving(false);
    }
  }, [userId, lines, name, servings, totals, totalGrams, parseSource]);

  const reset = useCallback(() => {
    setText(""); setName(""); setServings(1); setLines([]); setParseSource(null); setError("");
  }, []);

  return {
    text, setText, name, setName, servings, setServings, lines, parseSource, parsing, saving, error,
    totals, totalGrams, parse, setMatch, setLineQtyUnit, setLineGrams, researchLine, removeLine, save, reset,
  };
}
