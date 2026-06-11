import { iso, DEFAULT_PROGRAMME_START_ISO } from "./dates.js";
import { buildSchedule } from "./schedule.js";

export function exportJson(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "reintroduction-tracker-backup.json";
  a.click();
  URL.revokeObjectURL(url);
}

export function exportCsv(state) {
  const rows = [["Order", "Food", "Group", "Portion", "Status", "Introduce Date", "Observe Date", "Removed"]];

  const reintroBase = new Date(state.programmeStart || DEFAULT_PROGRAMME_START_ISO);
  reintroBase.setDate(reintroBase.getDate() + (state.detoxDuration ?? 14));

  // Use the same schedule builder the UI uses — respects pins and excludes Avoid foods.
  const scheduleRows = buildSchedule({
    foods: state.foods,
    status: state.status,
    pinnedFoods: state.pinnedFoods || {},
    skipObserve: state.skipObserve || {},
    reintroStart: reintroBase,
  });
  const scheduledDates = {};
  for (const row of scheduleRows) {
    if (!scheduledDates[row.food.id]) scheduledDates[row.food.id] = {};
    if (row.type === "Introduce") scheduledDates[row.food.id].intro = row.iso;
    if (row.type === "Observe")   scheduledDates[row.food.id].observe = row.iso;
  }

  state.foods.forEach((food, index) => {
    const dates = scheduledDates[food.id] || {};
    rows.push([
      index + 1, food.name, food.group, food.portion,
      state.status[food.id] || "Pending",
      dates.intro || "",
      dates.observe || "",
      "No"
    ]);
  });

  state.removed.forEach(food => {
    rows.push(["", food.name, food.group, food.portion, state.status[food.id] || "Pending", "", "", "Yes"]);
  });

  const csv = rows
    .map(row => row.map(v => `"${String(v ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "reintroduction-food-status.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export async function parseImportedJson(file, migrateState, initialState) {
  if (!file) return null;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.foods)) {
      alert("Import failed: JSON does not contain a valid foods list.");
      return null;
    }
    return migrateState(parsed, initialState);
  } catch {
    alert("Import failed: the file is not valid JSON.");
    return null;
  }
}
