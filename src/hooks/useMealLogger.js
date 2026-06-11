import { useState, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { parseRecipeText } from "../utils/recipeParse.js";
import { unitToGrams } from "../utils/recipeResolve.js";
import { num, computeLogMacros } from "../utils/foodLog.js";

const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));

// Normalized merge key for the cross-user community base. Lowercased, accents stripped,
// every run of non-alphanumerics collapsed to a single space. "Paneer Butter Masala!" and
// "paneer  butter masala" map to the same signature.
export function signatureOf(name) {
  // NFKD then drop anything non-alphanumeric — this also collapses leftover combining accent
  // marks, so "Café"/"cafe" and "Paneer Butter Masala!" normalize cleanly.
  return String(name || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
}

// Display name for a line: the matched food's name, else the user's typed term.
export function lineName(line) {
  if (!line.manual && line.matchIndex >= 0) return line.candidates[line.matchIndex]?.name || line.ingredient_guess;
  return (line.ingredient_guess || line.raw_text || "").trim();
}

// Per-line macros. Manual lines use the user-entered values; matched lines compute from grams.
// `accounted` = this line contributes to the day total (and is loggable).
export function lineMacros(line) {
  if (line.manual) {
    const mm = line.manualMacros || {};
    const kcal = num(mm.kcal);
    return { kcal, protein_g: num(mm.protein_g), fat_g: num(mm.fat_g), carb_g: num(mm.carb_g), fibre_g: num(mm.fibre_g), accounted: kcal > 0 };
  }
  const food = line.matchIndex >= 0 ? line.candidates[line.matchIndex] : null;
  if (food && num(line.grams) > 0) return { ...computeLogMacros(food, line.grams), accounted: true };
  return { kcal: 0, protein_g: 0, fat_g: 0, carb_g: 0, fibre_g: 0, accounted: false };
}

const EMPTY_MANUAL = { kcal: "", protein_g: "", fat_g: "", carb_g: "", fibre_g: "" };

// Drives the free-text Log flow: parse a typed meal into line items, resolve each against the
// food DB (reusing search_foods + measures + computeLogMacros), let the user fix matches/grams
// or enter a value manually for anything we can't account for, then log every accounted line as
// a food_logs row. Named accounted dishes are also upserted into community_entries so they can
// grow the cross-user recipe base. Data layer (search/fetchMeasures/units/addLog) is injected
// from useFoodLog so there's a single source of truth.
export function useMealLogger({ session, country = "india", search, fetchMeasures, units = [], addLog }) {
  const userId = session?.user?.id || null;
  const unitMap = useMemo(() => Object.fromEntries((units || []).map(u => [u.unit, num(u.grams)])), [units]);

  const [text, setText] = useState("");
  const [lines, setLines] = useState([]);
  const [parseSource, setParseSource] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [logging, setLogging] = useState(false);
  const [error, setError] = useState("");

  const resolveLine = useCallback(async (p) => {
    const candidates = await search(p.ingredient_guess, country).catch(() => []);
    const matchIndex = candidates.length ? 0 : -1;
    const food = matchIndex >= 0 ? candidates[0] : null;
    const measures = food ? await fetchMeasures(food.ingredient_id) : [];
    const { grams } = unitToGrams(p.qty, p.unit, measures, unitMap);
    return {
      id: uid(), raw_text: p.raw_text, qty: p.qty, unit: p.unit, ingredient_guess: p.ingredient_guess,
      candidates, matchIndex, measures, grams, manualGrams: false,
      manual: matchIndex < 0,            // unmatched lines start in manual mode so they're never silently dropped
      manualMacros: { ...EMPTY_MANUAL },
    };
  }, [search, fetchMeasures, country, unitMap]);

  const parse = useCallback(async () => {
    if (!text.trim()) return;
    setParsing(true); setError("");
    try {
      const res = await parseRecipeText(text);
      setParseSource(res.source);
      const resolved = await Promise.all((res.lines || []).map(resolveLine));
      setLines(resolved);
      if (!resolved.length) setError("Couldn't find any foods in that. Try simpler lines, one item each.");
    } catch (e) {
      setError(e.message || "Could not read that meal");
    } finally {
      setParsing(false);
    }
  }, [text, resolveLine]);

  const setMatch = useCallback(async (id, matchIndex) => {
    const line = lines.find(l => l.id === id);
    if (!line) return;
    const food = matchIndex >= 0 ? line.candidates[matchIndex] : null;
    const measures = food ? await fetchMeasures(food.ingredient_id) : [];
    setLines(ls => ls.map(l => {
      if (l.id !== id) return l;
      const grams = l.manualGrams ? l.grams : unitToGrams(l.qty, l.unit, measures, unitMap).grams;
      return { ...l, matchIndex, measures, grams, manual: false };
    }));
  }, [lines, fetchMeasures, unitMap]);

  const setGrams = useCallback((id, grams) => {
    setLines(ls => ls.map(l => l.id === id ? { ...l, grams: num(grams) || null, manualGrams: true } : l));
  }, []);

  // Re-run the food search for a line with a user-edited term — the way to fix a wrong/empty match.
  const researchLine = useCallback(async (id, term) => {
    const candidates = await search(term, country).catch(() => []);
    const matchIndex = candidates.length ? 0 : -1;
    const food = matchIndex >= 0 ? candidates[0] : null;
    const measures = food ? await fetchMeasures(food.ingredient_id) : [];
    setLines(ls => ls.map(l => {
      if (l.id !== id) return l;
      const grams = l.manualGrams ? l.grams : unitToGrams(l.qty, l.unit, measures, unitMap).grams;
      return { ...l, ingredient_guess: term, candidates, matchIndex, measures, grams, manual: matchIndex < 0 };
    }));
  }, [search, fetchMeasures, country, unitMap]);

  const setManual = useCallback((id, on) => {
    setLines(ls => ls.map(l => l.id === id ? { ...l, manual: on } : l));
  }, []);

  const setManualMacros = useCallback((id, patch) => {
    setLines(ls => ls.map(l => l.id === id ? { ...l, manualMacros: { ...l.manualMacros, ...patch } } : l));
  }, []);

  const removeLine = useCallback((id) => setLines(ls => ls.filter(l => l.id !== id)), []);

  const reset = useCallback(() => { setText(""); setLines([]); setParseSource(null); setError(""); }, []);

  const totals = useMemo(() => {
    let accounted = 0, unaccounted = 0;
    const t = lines.reduce((a, l) => {
      const m = lineMacros(l);
      if (m.accounted) accounted++; else unaccounted++;
      return { kcal: a.kcal + m.kcal, protein_g: a.protein_g + m.protein_g, fat_g: a.fat_g + m.fat_g, carb_g: a.carb_g + m.carb_g, fibre_g: a.fibre_g + m.fibre_g };
    }, { kcal: 0, protein_g: 0, fat_g: 0, carb_g: 0, fibre_g: 0 });
    return { ...t, counts: { accounted, unaccounted, lines: lines.length } };
  }, [lines]);

  // Best-effort: contribute named, accounted dishes to the cross-user base. Deduped by
  // signature within the batch to respect the unique (created_by, signature) constraint.
  const captureCommunity = useCallback(async () => {
    if (!userId) return;
    const bySig = new Map();
    for (const l of lines) {
      const m = lineMacros(l);
      if (!m.accounted) continue;
      const name = lineName(l).slice(0, 120);
      const signature = signatureOf(name);
      if (!signature) continue;
      bySig.set(signature, {
        created_by: userId, signature, name,
        kcal: Math.round(m.kcal),
        protein_g: Math.round(m.protein_g * 10) / 10, fat_g: Math.round(m.fat_g * 10) / 10,
        carb_g: Math.round(m.carb_g * 10) / 10, fibre_g: Math.round(m.fibre_g * 10) / 10,
      });
    }
    if (!bySig.size) return;
    try { await supabase.from("community_entries").upsert([...bySig.values()], { onConflict: "created_by,signature" }); }
    catch { /* community capture is non-critical — never block logging */ }
  }, [lines, userId]);

  // Insert one food_logs row per accounted line. addLog (from useFoodLog) supplies user_id +
  // log_date and reloads the day. Returns counts so the UI can confirm / warn about skipped items.
  const logAll = useCallback(async (meal) => {
    if (!lines.length) return { logged: 0, skipped: 0, error: "Nothing to log" };
    setLogging(true); setError("");
    let logged = 0, skipped = 0;
    try {
      for (const line of lines) {
        const m = lineMacros(line);
        if (!m.accounted) { skipped++; continue; }
        const food = !line.manual && line.matchIndex >= 0 ? line.candidates[line.matchIndex] : null;
        const row = food
          ? {
              source: "ingredient", ingredient_id: food.ingredient_id, custom_name: food.name, meal,
              qty: num(line.qty) > 0 ? num(line.qty) : 1, unit: line.unit || "g", grams: num(line.grams) || null,
              kcal: m.kcal, protein_g: m.protein_g, fat_g: m.fat_g, carb_g: m.carb_g, fibre_g: m.fibre_g,
            }
          : {
              source: "custom", custom_name: lineName(line) || "Custom item", meal,
              qty: 1, unit: "serving", grams: num(line.grams) || null,
              kcal: m.kcal, protein_g: m.protein_g, fat_g: m.fat_g, carb_g: m.carb_g, fibre_g: m.fibre_g,
            };
        const { error: e } = await addLog(row);
        if (e) { setError(e); setLogging(false); return { logged, skipped, error: e }; }
        logged++;
      }
      await captureCommunity();
      return { logged, skipped, error: null };
    } finally {
      setLogging(false);
    }
  }, [lines, addLog, captureCommunity]);

  return {
    text, setText, lines, parseSource, parsing, logging, error, totals,
    parse, setMatch, setGrams, researchLine, setManual, setManualMacros, removeLine, logAll, reset,
  };
}
