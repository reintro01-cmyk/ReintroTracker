import { DEFAULT_FOODS } from "../data/foods";
import { DEFAULT_PROGRAMME_START_ISO } from "./dates.js";

export const APP_VERSION = 8;

const DEFAULT_NUTRITION = {
  dailyCalories: 800,
  macros: { fat: 25, carbs: 20, protein: 35, fibre: 20 }
};

export function migrateState(savedState, initialState) {
  const base = initialState();

  if (!savedState || !Array.isArray(savedState.foods)) {
    return base;
  }

  const allSavedFoods = [
    ...(Array.isArray(savedState.foods)   ? savedState.foods   : []),
    ...(Array.isArray(savedState.removed) ? savedState.removed : []),
  ];
  const savedIds     = new Set(allSavedFoods.map(f => f.id));
  const missingFoods = DEFAULT_FOODS.filter(f => !savedIds.has(f.id));

  // Backfill body
  const body = savedState.body
    ? {
        profile:      savedState.body.profile      ?? base.body.profile,
        weights:      savedState.body.weights       ?? [],
        measurements: savedState.body.measurements  ?? [],
        customFields: Array.isArray(savedState.body.customFields) ? savedState.body.customFields : [],
        unit:         savedState.body.unit          ?? "cm",
      }
    : base.body;

  // Backfill nutrition (added in v3; mealMerge added in v5)
  // APP_VERSION must be bumped whenever a new persisted field is added.
  const nutrition = savedState.nutrition
    ? {
        dailyCalories: savedState.nutrition.dailyCalories ?? DEFAULT_NUTRITION.dailyCalories,
        macros: {
          fat:     savedState.nutrition.macros?.fat     ?? DEFAULT_NUTRITION.macros.fat,
          carbs:   savedState.nutrition.macros?.carbs   ?? DEFAULT_NUTRITION.macros.carbs,
          protein: savedState.nutrition.macros?.protein ?? DEFAULT_NUTRITION.macros.protein,
          fibre:   savedState.nutrition.macros?.fibre   ?? DEFAULT_NUTRITION.macros.fibre,
        },
        mealMerge: savedState.nutrition.mealMerge ?? null,
      }
    : DEFAULT_NUTRITION;

  // Any existing saved state = user has already been through setup (backfill onboardingComplete: true)
  const onboardingComplete = savedState.onboardingComplete ?? true;
  const programmeStart     = savedState.programmeStart     ?? DEFAULT_PROGRAMME_START_ISO;
  const detoxDuration      = savedState.detoxDuration      ?? 14;
  const weightGoal         = savedState.weightGoal         ?? null;
  const introOrder         = savedState.introOrder         ?? "standard";
  const preferredGroups    = Array.isArray(savedState.preferredGroups) ? savedState.preferredGroups : [];
  const priorityFoods      = Array.isArray(savedState.priorityFoods)   ? savedState.priorityFoods   : [];

  return {
    ...base,
    ...savedState,
    appVersion:   APP_VERSION,
    foods:        [...savedState.foods, ...missingFoods],
    removed:      Array.isArray(savedState.removed) ? savedState.removed : [],
    intake:       savedState.intake       || {},
    observations: savedState.observations || {},
    status:       savedState.status       || {},
    user:         savedState.user         || base.user,
    body,
    nutrition,
    favourites:      Array.isArray(savedState.favourites)      ? savedState.favourites      : [],
    favouriteFoods:  Array.isArray(savedState.favouriteFoods)  ? savedState.favouriteFoods  : [],
    // pinnedFoods (added v6): { foodId: isoDate } — foods pinned to a specific introduce day
    pinnedFoods:     (savedState.pinnedFoods && typeof savedState.pinnedFoods === "object" && !Array.isArray(savedState.pinnedFoods))
                       ? savedState.pinnedFoods : {},
    // skipObserve (added v8): { foodId: true } — foods reintroduced without an observation day
    skipObserve:     (savedState.skipObserve && typeof savedState.skipObserve === "object" && !Array.isArray(savedState.skipObserve))
                       ? savedState.skipObserve : {},
    onboardingComplete,
    programmeStart,
    detoxDuration,
    weightGoal,
    introOrder,
    preferredGroups,
    priorityFoods,
  };
}
