import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { todayIso } from "../utils/dates.js";
import { sumTotals, num } from "../utils/foodLog.js";

// Food logging data layer. Talks to Supabase directly (relational), separate from the
// tracker_states blob: search_foods RPC, food_logs CRUD, per-ingredient measures,
// unit_defaults. Owner-RLS scopes everything to the signed-in user.
export function useFoodLog(session) {
  const userId = session?.user?.id || null;
  const [date, setDate] = useState(todayIso());
  const [logs, setLogs] = useState([]);
  const [units, setUnits] = useState([]);
  const [history, setHistory] = useState([]);
  const [dayHistory, setDayHistory] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    supabase.from("unit_defaults").select("unit,grams").then(({ data }) => setUnits(data || []));
  }, []);

  // Build a frequency-ranked list of the user's previously-logged dishes (across all days),
  // deduped by name, each carrying its last portion + macros so it can be re-logged in one tap.
  const loadHistory = useCallback(async () => {
    if (!userId) { setHistory([]); return; }
    const { data } = await supabase
      .from("food_logs")
      .select("custom_name,source,ingredient_id,recipe_id,meal,qty,unit,grams,kcal,protein_g,fat_g,carb_g,fibre_g")
      .eq("user_id", userId)
      .order("logged_at", { ascending: false })
      .limit(400);
    const byName = new Map();
    for (const r of data || []) {
      const key = (r.custom_name || "").trim().toLowerCase();
      if (!key) continue;
      if (byName.has(key)) byName.get(key).count++;
      else byName.set(key, { ...r, count: 1 });   // first seen = most recent (desc order)
    }
    setHistory([...byName.values()].sort((a, b) => b.count - a.count));
  }, [userId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Per-day rollups across all of the user's logged days, newest first — powers the
  // "past days" history list (jump to any prior day).
  const loadDayHistory = useCallback(async () => {
    if (!userId) { setDayHistory([]); return; }
    const { data } = await supabase
      .from("food_logs")
      .select("log_date,kcal")
      .eq("user_id", userId)
      .order("log_date", { ascending: false })
      .limit(3000);
    const byDate = new Map();
    for (const r of data || []) {
      const k = r.log_date;
      if (!byDate.has(k)) byDate.set(k, { date: k, kcal: 0, count: 0 });
      const e = byDate.get(k);
      e.kcal += num(r.kcal);
      e.count++;
    }
    setDayHistory([...byDate.values()]);   // already date-desc from the ordered query
  }, [userId]);

  useEffect(() => { loadDayHistory(); }, [loadDayHistory]);

  const loadLogs = useCallback(async () => {
    if (!userId) { setLogs([]); return; }
    setLoadingLogs(true);
    const { data } = await supabase
      .from("food_logs").select("*")
      .eq("user_id", userId).eq("log_date", date)
      .order("logged_at", { ascending: true });
    setLogs(data || []);
    setLoadingLogs(false);
  }, [userId, date]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const search = useCallback(async (q, country) => {
    if (!q || q.trim().length < 2) return [];
    const { data, error } = await supabase.rpc("search_foods", { q: q.trim(), country: country ?? null, lim: 12 });
    if (error) throw new Error(error.message);
    return data || [];
  }, []);

  const fetchMeasures = useCallback(async (ingredientId) => {
    if (!ingredientId) return [];
    const { data } = await supabase
      .from("measures").select("label,unit,grams,is_default")
      .eq("ingredient_id", ingredientId)
      .order("is_default", { ascending: false }).order("grams", { ascending: true })
      .limit(12);
    return data || [];
  }, []);

  const addLog = useCallback(async (row) => {
    if (!userId) return { error: "Not signed in" };
    const { error } = await supabase.from("food_logs").insert({ ...row, user_id: userId, log_date: date });
    if (!error) { await loadLogs(); loadHistory(); loadDayHistory(); }
    return { error: error?.message || null };
  }, [userId, date, loadLogs, loadHistory, loadDayHistory]);

  const removeLog = useCallback(async (id) => {
    await supabase.from("food_logs").delete().eq("id", id);
    await loadLogs(); loadDayHistory();
  }, [loadLogs, loadDayHistory]);

  const totals = useMemo(() => sumTotals(logs), [logs]);

  return { date, setDate, logs, units, totals, history, dayHistory, loadingLogs, search, fetchMeasures, addLog, removeLog };
}
