// Builds a shareable plain-text summary of a single day's food log — meal headings, each item
// with its portion, a date stamp, and an optional calorie total. Kept pure (no DOM) so it's
// testable and reusable; the image/canvas rendering lives in the ShareLogModal component.

import { num } from "./foodLog.js";

const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snack"];
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);

// A human portion for one logged item: prefer the household unit it was logged in
// (e.g. "1 katori", "2 piece"); otherwise fall back to grams, then a bare quantity.
export function portionText(l) {
  const q = num(l.qty);
  if (l.unit && l.unit !== "g" && q > 0) return `${Math.round(q * 100) / 100} ${l.unit}`;
  if (num(l.grams) > 0) return `${Math.round(num(l.grams))}g`;
  if (q > 0) return `${Math.round(q * 100) / 100}`;
  return "";
}

// Group a day's logs by meal, in breakfast→snack order (unknown meals sort last).
export function groupLogsByMeal(logs = []) {
  const m = new Map();
  for (const l of logs) {
    const key = l.meal || "other";
    if (!m.has(key)) m.set(key, []);
    m.get(key).push(l);
  }
  return [...m.keys()]
    .sort((a, b) => (MEAL_ORDER.indexOf(a) + 1 || 99) - (MEAL_ORDER.indexOf(b) + 1 || 99))
    .map(meal => ({ meal, items: m.get(meal) }));
}

export function formatShareDate(dateIso) {
  return new Date(dateIso + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

export function buildLogShareText({ logs = [], dateIso, totalKcal = null }) {
  const lines = [`🍽️ Food log · ${formatShareDate(dateIso)}`];
  for (const g of groupLogsByMeal(logs)) {
    lines.push("", cap(g.meal));
    for (const l of g.items) {
      const p = portionText(l);
      lines.push(`• ${l.custom_name}${p ? ` — ${p}` : ""}`);
    }
  }
  if (totalKcal != null && totalKcal > 0) lines.push("", `Total: ${Math.round(totalKcal)} kcal`);
  return lines.join("\n");
}
