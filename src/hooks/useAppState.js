import { useState, useEffect, useRef, useMemo } from "react";
import { iso, DEFAULT_PROGRAMME_START_ISO } from "../utils/dates";
import { exportJson, exportCsv, parseImportedJson } from "../utils/exporters.js";
import { DEFAULT_FOODS } from "../data/foods";
import { APP_VERSION, migrateState } from "../utils/migrations";
import { getCurrentPhase } from "../utils/mealPlanner.js";
import { buildSchedule, pinConflict } from "../utils/schedule.js";
import { supabase } from "../lib/supabase";

const STORAGE_KEY = "reintroduction_tracker_web_app_v1";

export function initialState() {
  return {
    appVersion: APP_VERSION,
    foods: DEFAULT_FOODS,
    removed: [],
    intake: {},
    observations: {},
    status: {},
    body: {
      profile: { heightCm: "", neckCm: "" },
      weights: [],
      measurements: [],
      customFields: [],
      unit: "cm"
    },
    nutrition: {
      dailyCalories: 800,
      macros: { fat: 25, carbs: 20, protein: 35, fibre: 20 },
      mealMerge: null,
    },
    favourites: [],
    favouriteFoods: [],
    programmeStart:    DEFAULT_PROGRAMME_START_ISO,
    detoxDuration:     14,
    weightGoal:        null,
    onboardingComplete: false,
    introOrder:         "standard",
    preferredGroups:    [],
    priorityFoods:      [],
    allergies:          [],
    pinnedFoods:        {},
    skipObserve:        {},
    user: { name: "", programme: "Food Reintroduction" }
  };
}

export function useAppState({ session, showToast }) {
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.foods)) return migrateState(parsed, initialState);
      }
    } catch {}
    return initialState();
  });

  const [syncStatus, setSyncStatus] = useState("Local");
  const [recentlyClearedFoodId, setRecentlyClearedFoodId] = useState(null);
  const loadedCloudRef = useRef(false);
  const saveTimerRef = useRef(null);

  // Reset cloud tracking when session changes (handles sign-in, sign-out, auth change)
  useEffect(() => {
    loadedCloudRef.current = false;
    if (!session) setSyncStatus("Local");
  }, [session]);

  // Local persistence for unauthenticated users
  useEffect(() => {
    if (session) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, session]);

  // Cloud save (debounced)
  useEffect(() => {
    if (!session?.user?.id || !loadedCloudRef.current) return;
    localStorage.setItem(`${STORAGE_KEY}:${session.user.id}`, JSON.stringify(state));
    setSyncStatus("Saving…");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const { error } = await supabase
        .from("tracker_states")
        .upsert({ user_id: session.user.id, state, updated_at: new Date().toISOString() });
      setSyncStatus(error ? `Save failed: ${error.message}` : "Synced ✓");
    }, 700);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [state, session]);

  // Cloud load
  useEffect(() => {
    async function loadCloud() {
      if (!session?.user?.id || loadedCloudRef.current) return;
      setSyncStatus("Loading…");
      const { data, error } = await supabase
        .from("tracker_states")
        .select("state")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error) { setSyncStatus(`Load failed: ${error.message}`); loadedCloudRef.current = true; return; }

      if (data?.state && Array.isArray(data.state.foods)) {
        const migrated = migrateState(data.state, initialState);
        setState(migrated);
        if ((data.state.appVersion || 1) < APP_VERSION || migrated.foods.length !== data.state.foods.length) {
          await supabase.from("tracker_states").upsert({ user_id: session.user.id, state: migrated, updated_at: new Date().toISOString() });
          setSyncStatus("Loaded + upgraded ✓");
        } else {
          setSyncStatus("Loaded ✓");
        }
      } else {
        const base = initialState();
        setState(base);
        await supabase.from("tracker_states").upsert({ user_id: session.user.id, state: base, updated_at: new Date().toISOString() });
        setSyncStatus("Created new cloud state ✓");
      }
      loadedCloudRef.current = true;
    }
    loadCloud();
  }, [session]);

  // ── Derived data ───────────────────────────────────────────────────────────
  const phaseInfo = useMemo(
    () => getCurrentPhase(state.status, state.programmeStart, state.detoxDuration),
    [state.status, state.programmeStart, state.detoxDuration]
  );

  const reintroStart = useMemo(() => {
    const d = new Date(state.programmeStart);
    d.setDate(d.getDate() + (state.detoxDuration ?? 14));
    return d;
  }, [state.programmeStart, state.detoxDuration]);

  // Schedule honours pinned foods (fixed introduce dates) and excludes Avoided
  // foods. See utils/schedule.js for the assignment rules.
  const schedule = useMemo(
    () => buildSchedule({
      foods: state.foods,
      status: state.status,
      pinnedFoods: state.pinnedFoods,
      skipObserve: state.skipObserve,
      reintroStart,
      allergies: state.allergies,
    }),
    [state.foods, state.status, state.pinnedFoods, state.skipObserve, reintroStart, state.allergies]
  );

  const todayItem = useMemo(() => {
    const todayIso = iso(new Date());
    return schedule.find(item => item.iso === todayIso) || null;
  }, [schedule]);

  const stats = useMemo(() => {
    const values = state.foods.map(f => state.status[f.id] || "Pending");
    const safe    = values.filter(v => v === "Safe").length;
    const limit   = values.filter(v => v === "Limit").length;
    const avoid   = values.filter(v => v === "Avoid").length;
    const pending = values.filter(v => v === "Pending").length;
    const done    = safe + limit + avoid;
    const total   = state.foods.length;
    return { active: total, removed: state.removed.length, safe, limit, avoid, pending, done, percent: total ? Math.round(done / total * 100) : 0 };
  }, [state]);

  const months = useMemo(() => {
    if (!schedule.length) return [];
    const grouped = {};
    schedule.forEach(item => {
      const key = `${item.date.getFullYear()}-${item.date.getMonth()}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });
    return Object.entries(grouped).map(([key, items]) => ({ key, items }));
  }, [schedule]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  function resetState() { setState(initialState()); }

  function updateFoodStatus(foodId, verdict, obs) {
    setState(prev => ({ ...prev, status: { ...prev.status, [foodId]: verdict }, observations: { ...prev.observations, [foodId]: obs } }));
    showToast(`${verdict} — observation saved!`);
    if (verdict === "Safe") {
      setRecentlyClearedFoodId(foodId);
      setTimeout(() => setRecentlyClearedFoodId(prev => (prev === foodId ? null : prev)), 600);
    }
  }

  function saveIntake(foodId, intake) {
    setState(prev => ({ ...prev, intake: { ...prev.intake, [foodId]: intake } }));
    showToast("Intake logged ✓");
  }

  function removeFood(foodId) {
    setState(prev => {
      const food = prev.foods.find(f => f.id === foodId);
      if (!food) return prev;
      return { ...prev, foods: prev.foods.filter(f => f.id !== foodId), removed: [...prev.removed, food] };
    });
  }

  function restoreFood(foodId) {
    setState(prev => {
      const food = prev.removed.find(f => f.id === foodId);
      if (!food) return prev;
      return { ...prev, foods: [...prev.foods, food], removed: prev.removed.filter(f => f.id !== foodId) };
    });
  }

  function addNewFood(food) {
    const idBase = food.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setState(prev => ({ ...prev, foods: [...prev.foods, { ...food, id: `${idBase || "food"}-${Date.now()}` }] }));
  }

  function moveFood(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return;
    setState(prev => {
      const foods = [...prev.foods];
      const from = foods.findIndex(f => f.id === fromId);
      const to   = foods.findIndex(f => f.id === toId);
      if (from < 0 || to < 0) return prev;
      const [item] = foods.splice(from, 1);
      const newTo  = foods.findIndex(f => f.id === toId);
      foods.splice(newTo, 0, item);
      return { ...prev, foods };
    });
  }

  function resetAll() {
    if (!confirm("Reset tracker data to the base state?")) return;
    setState(initialState());
  }

  function handleOnboardingComplete({ programmeStart, introOrder, preferredGroups, priorityFoods, allergies = [], onboardingComplete }) {
    setState(prev => {
      let foods = [...prev.foods];
      if (introOrder === "group" && preferredGroups.length) {
        const groupRank = Object.fromEntries(preferredGroups.map((g, i) => [g, i]));
        foods.sort((a, b) => (groupRank[a.group] ?? 999) - (groupRank[b.group] ?? 999));
      } else if (introOrder === "priority" && priorityFoods.length) {
        const prioritySet = new Set(priorityFoods);
        foods = [...foods.filter(f => prioritySet.has(f.id)), ...foods.filter(f => !prioritySet.has(f.id))];
      }
      // Declared allergies are marked Avoid up front, so their recipes are filtered and
      // they're skipped in the reintroduction schedule.
      const status = { ...prev.status };
      for (const id of allergies) status[id] = "Avoid";
      return { ...prev, programmeStart, introOrder, preferredGroups, priorityFoods, allergies, onboardingComplete, foods, status };
    });
  }

  // Reorder the schedule by group. Moves whole group BLOCKS while preserving each
  // food's existing relative order within its group (Array.sort is stable) — so
  // "move fruits to the end" relocates only the fruit block and leaves every other
  // food exactly where the user put it. Unlike the old version it no longer
  // re-sorts every pending food (which flattened any hand-arranged order) and it
  // operates on the existing foods list only, so removed/allergy foods can't return.
  function reorderFoodsByGroups(groupOrder) {
    if (!Array.isArray(groupOrder) || !groupOrder.length) return;
    const rank = g => { const i = groupOrder.indexOf(g); return i < 0 ? 999 : i; };
    setState(prev => {
      const foods = [...prev.foods].sort((a, b) => rank(a.group) - rank(b.group));
      return { ...prev, foods, introOrder: "group", preferredGroups: groupOrder };
    });
    showToast("Order updated ✓");
  }

  // First-class allergy list. Declared allergies are force-marked Avoid (so they're
  // excluded from the schedule and recipe suggestions) and persisted separately, so
  // nothing — a reorder, a status change, a fresh cloud load — can resurface them.
  // Removing an allergy reverts its Avoid verdict to Pending so it can be tested.
  function updateAllergies(ids) {
    const next = [...new Set(Array.isArray(ids) ? ids : [])];
    setState(prev => {
      const prevSet = new Set(prev.allergies || []);
      const nextSet = new Set(next);
      const status = { ...prev.status };
      for (const id of next) status[id] = "Avoid";
      for (const id of prevSet) if (!nextSet.has(id) && status[id] === "Avoid") status[id] = "Pending";
      return { ...prev, allergies: next, status };
    });
    showToast("Allergies updated ✓");
  }

  // Restore the default (data/foods.js) ordering. Custom foods not in the default
  // list are appended at the end in their current relative order.
  function resetFoodOrder() {
    const defaultRank = Object.fromEntries(DEFAULT_FOODS.map((f, i) => [f.id, i]));
    setState(prev => {
      const foods = [...prev.foods].sort(
        (a, b) => (defaultRank[a.id] ?? 9999) - (defaultRank[b.id] ?? 9999)
      );
      return { ...prev, foods, introOrder: "standard", preferredGroups: [] };
    });
    showToast("Default order restored ✓");
  }

  // Pin a food to a specific introduce date (snapped to the 2-day cadence). Rejects
  // if another pinned food already owns that cycle. Returns true on success.
  function pinFoodDate(foodId, dateIso) {
    if (!foodId || !dateIso) return false;
    const conflictId = pinConflict({ foodId, targetIso: dateIso, pinnedFoods: state.pinnedFoods || {}, reintroStart });
    if (conflictId) {
      const cf = state.foods.find(f => f.id === conflictId);
      showToast(`That day already has ${cf?.name || "another food"} pinned — pick another day`);
      return false;
    }
    // dateIso is already a real introduce day (the picker only offers valid days), so store it
    // directly — there's no uniform cadence to snap to anymore.
    setState(prev => ({ ...prev, pinnedFoods: { ...(prev.pinnedFoods || {}), [foodId]: dateIso } }));
    showToast("Pinned to schedule ✓");
    return true;
  }

  // Per-food cadence: needed=true keeps the observation day (default); false drops it so the
  // food occupies a single day and the next food is introduced sooner.
  function setObserveDay(foodId, needed) {
    setState(prev => {
      const next = { ...(prev.skipObserve || {}) };
      if (needed) delete next[foodId]; else next[foodId] = true;
      return { ...prev, skipObserve: next };
    });
  }

  function unpinFood(foodId) {
    setState(prev => {
      const next = { ...(prev.pinnedFoods || {}) };
      delete next[foodId];
      return { ...prev, pinnedFoods: next };
    });
    showToast("Unpinned ✓");
  }

  function handleProgrammeSettingsUpdate({ programmeStart, detoxDuration }) {
    setState(prev => ({ ...prev, programmeStart, ...(detoxDuration != null && { detoxDuration }) }));
    showToast("Programme dates updated ✓");
  }

  function handleWeightGoalChange(goal) { setState(prev => ({ ...prev, weightGoal: goal })); }

  function toggleFavouriteFood(foodId) {
    setState(prev => {
      const list = Array.isArray(prev.favouriteFoods) ? prev.favouriteFoods : [];
      return { ...prev, favouriteFoods: list.includes(foodId) ? list.filter(id => id !== foodId) : [...list, foodId] };
    });
  }

  function toggleFavouriteRecipe(id) {
    setState(prev => ({
      ...prev,
      favourites: prev.favourites.includes(id) ? prev.favourites.filter(f => f !== id) : [...prev.favourites, id],
    }));
  }

  function updateBody(patch) { setState(prev => ({ ...prev, body: { ...prev.body, ...patch } })); }

  function updateNutrition(nutrition) { setState(prev => ({ ...prev, nutrition })); }

  function updateUserName(name) { setState(prev => ({ ...prev, user: { ...prev.user, name } })); }

  async function handleImportJson(file) {
    const importedState = await parseImportedJson(file, migrateState, initialState);
    if (!importedState) return;
    setState(importedState);
    showToast("Data imported successfully ✓");
  }

  return {
    state, syncStatus, recentlyClearedFoodId,
    phaseInfo, reintroStart, schedule, todayItem, stats, months,
    resetState,
    updateFoodStatus, saveIntake, removeFood, restoreFood, addNewFood,
    moveFood, resetAll, handleOnboardingComplete, handleProgrammeSettingsUpdate,
    reorderFoodsByGroups, resetFoodOrder, updateAllergies, pinFoodDate, unpinFood,
    handleWeightGoalChange, toggleFavouriteFood, toggleFavouriteRecipe, setObserveDay,
    updateBody, updateNutrition, updateUserName, handleImportJson,
    exportJson: () => exportJson(state),
    exportCsv:  () => exportCsv(state),
  };
}
