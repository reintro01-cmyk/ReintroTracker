// Natural-language → group ordering for the reintroduction schedule.
//
// The 12 food groups are a closed vocabulary, so a deterministic parser handles
// the overwhelming majority of requests ("dairy first, meats second", "sugar last")
// instantly, offline, and predictably. Open-ended phrasing the parser can't resolve
// is handed to the LLM fallback (see utils/scheduleAI.js) by the caller when
// `recognized === 0`.

// Canonical group names must match exactly the `group` values in data/foods.js.
const GROUP_DEFS = [
  { canonical: "Dairy", aliases: ["dairy", "milk", "curd", "yogurt", "yoghurt", "paneer", "cheese"] },
  { canonical: "Animal protein", aliases: ["animal protein", "meat", "meats", "non veg", "nonveg", "non-veg", "seafood", "chicken", "fish", "egg", "eggs", "poultry"] },
  { canonical: "Grains / carbs", aliases: ["grain", "grains", "carb", "carbs", "carbohydrate", "carbohydrates", "rice", "wheat", "chapati", "roti", "cereal"] },
  { canonical: "Dals / pulses / nuts / seeds", aliases: ["dal", "dals", "daal", "pulse", "pulses", "lentil", "lentils", "legume", "legumes", "nut", "nuts", "seed", "seeds", "beans"] },
  { canonical: "Vegetables", aliases: ["veg", "veggie", "veggies", "vegetable", "vegetables"] },
  { canonical: "Fruits", aliases: ["fruit", "fruits"] },
  { canonical: "Oils / fats", aliases: ["oil", "oils", "fat", "fats", "ghee", "butter"] },
  { canonical: "Spices / masala", aliases: ["spice", "spices", "masala", "masalas", "seasoning", "seasonings"] },
  { canonical: "Condiments / bases", aliases: ["condiment", "condiments", "sauce", "sauces", "pickle", "vinegar", "tamarind"] },
  { canonical: "Processed / outside food", aliases: ["processed", "junk", "outside food", "packaged", "restaurant", "fast food", "fastfood"] },
  { canonical: "Drinks", aliases: ["drink", "drinks", "beverage", "beverages", "tea", "coffee"] },
  { canonical: "Sweeteners", aliases: ["sweetener", "sweeteners", "sweet", "sweets", "sugar", "jaggery", "honey"] },
];

export const ALL_GROUP_NAMES = GROUP_DEFS.map(g => g.canonical);

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Earliest word-boundary match index of any alias for a group, or -1.
// Word boundaries avoid false hits like "egg" inside "veggies".
function firstMatchIndex(text, aliases) {
  let best = Infinity;
  for (const a of aliases) {
    const m = new RegExp(`\\b${escapeRegex(a)}\\b`).exec(text);
    if (m && m.index < best) best = m.index;
  }
  return best === Infinity ? -1 : best;
}

// Indices of every "send to the back" keyword in the text.
function lastKeywordIndices(text) {
  const re = /\b(last|end|finally|lastly)\b/g;
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) out.push(m.index);
  return out;
}

// Bind each last-keyword to a group: the nearest group mentioned *before* it
// ("sugar last", "processed food at the end"), else the nearest one after it
// ("lastly, sugar"). Returns the set of groups that should go to the back.
function resolveLastGroups(text, mentions) {
  const flags = new Set();
  for (const k of lastKeywordIndices(text)) {
    let before = null, beforeIdx = -1;
    let after = null, afterIdx = Infinity;
    for (const men of mentions) {
      if (men.index < k && men.index > beforeIdx) { beforeIdx = men.index; before = men.group; }
      if (men.index > k && men.index < afterIdx) { afterIdx = men.index; after = men.group; }
    }
    const g = before ?? after;
    if (g) flags.add(g);
  }
  return flags;
}

/**
 * Parse a free-text ordering request into a full group ordering.
 *
 * @param {string} text          - user's requirement, e.g. "dairy first, meats second"
 * @param {string[]} [available] - groups actually present in the user's food list
 *                                 (defaults to all 12). Output is restricted to these.
 * @returns {{ order: string[], matched: string[], recognized: number }}
 *   order      — complete ordering of `available` groups (ranked first, then untouched, then "last")
 *   matched    — groups the text explicitly referenced, in resolved order
 *   recognized — matched.length (0 ⇒ caller should try the LLM fallback)
 */
export function parseGroupOrder(text, available = ALL_GROUP_NAMES) {
  const t = (text || "").toLowerCase();
  const availableSet = new Set(available);

  const mentions = [];   // { group, index } — one per matched group
  for (const def of GROUP_DEFS) {
    if (!availableSet.has(def.canonical)) continue;
    const idx = firstMatchIndex(t, def.aliases);
    if (idx !== -1) mentions.push({ group: def.canonical, index: idx });
  }

  const lastFlags = resolveLastGroups(t, mentions);
  const ranked = mentions.filter(x => !lastFlags.has(x.group)).sort((a, b) => a.index - b.index);
  const lasts = mentions.filter(x => lastFlags.has(x.group)).sort((a, b) => a.index - b.index);

  const matchedGroups = new Set([...ranked, ...lasts].map(x => x.group));
  const untouched = available.filter(g => !matchedGroups.has(g));

  const order = [
    ...ranked.map(x => x.group),
    ...untouched,
    ...lasts.map(x => x.group),
  ];

  const matched = [...ranked.map(x => x.group), ...lasts.map(x => x.group)];
  return { order, matched, recognized: matched.length };
}

/**
 * Validate/normalise an arbitrary group ordering (e.g. from the LLM) against the
 * available groups: keep only known groups, dedupe, then append any missing
 * available groups in their default order so the result is always complete.
 */
export function normaliseGroupOrder(proposed, available = ALL_GROUP_NAMES) {
  const availableSet = new Set(available);
  const seen = new Set();
  const head = [];
  for (const g of Array.isArray(proposed) ? proposed : []) {
    if (availableSet.has(g) && !seen.has(g)) { seen.add(g); head.push(g); }
  }
  const tail = available.filter(g => !seen.has(g));
  return [...head, ...tail];
}
