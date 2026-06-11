// Detox started May 18, 2026  →  reintroduction begins June 1, 2026 (day 15)
export const DEFAULT_PROGRAMME_START_ISO = "2026-05-18";

// Legacy Date object kept for any call-sites not yet migrated
export const START_DATE = new Date(2026, 5, 1);

export function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

// Local-time ISO date (yyyy-mm-dd). Must NOT go through toISOString(), which
// returns UTC and rolls back a day for positive-offset users (e.g. IST between
// 00:00 and 05:30 local would otherwise report "yesterday").
export function iso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayIso() {
  return iso(new Date());
}

export function displayDate(date) {
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}