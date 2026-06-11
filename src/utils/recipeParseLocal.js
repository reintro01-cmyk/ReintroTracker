// Local, offline fallback for the recipe parser. Mirrors the parse-recipe edge function's
// output contract — { servings, lines: [{ raw_text, qty, unit, ingredient_guess }] } — using
// regex heuristics. Same hard rule: this NEVER emits nutrition; it only splits text into
// quantity / unit / ingredient. Used when the LLM edge function is unreachable so the recipe
// flow still works (degraded), or for tests. Units are normalised to the same allowed set;
// metric/imperial weights are converted to g/ml so downstream gram resolution stays simple.

const ALLOWED_UNITS = new Set(["g", "ml", "tsp", "tbsp", "cup", "katori", "bowl", "glass", "piece", "slice", "handful", "plate"]);

// alias -> [normalised unit, factor applied to qty]. Weight/volume aliases collapse to g/ml.
const UNIT_MAP = {
  g: ["g", 1], gram: ["g", 1], grams: ["g", 1], gm: ["g", 1], gms: ["g", 1],
  kg: ["g", 1000], kgs: ["g", 1000], kilogram: ["g", 1000], kilograms: ["g", 1000],
  mg: ["g", 0.001],
  ml: ["ml", 1], cc: ["ml", 1], milliliter: ["ml", 1], millilitre: ["ml", 1], milliliters: ["ml", 1], millilitres: ["ml", 1],
  l: ["ml", 1000], lt: ["ml", 1000], liter: ["ml", 1000], litre: ["ml", 1000], liters: ["ml", 1000], litres: ["ml", 1000],
  oz: ["g", 28.35], ounce: ["g", 28.35], ounces: ["g", 28.35],
  lb: ["g", 453.6], lbs: ["g", 453.6], pound: ["g", 453.6], pounds: ["g", 453.6],
  tsp: ["tsp", 1], tsps: ["tsp", 1], teaspoon: ["tsp", 1], teaspoons: ["tsp", 1],
  tbsp: ["tbsp", 1], tbs: ["tbsp", 1], tbsps: ["tbsp", 1], tablespoon: ["tbsp", 1], tablespoons: ["tbsp", 1],
  cup: ["cup", 1], cups: ["cup", 1],
  katori: ["katori", 1], katoris: ["katori", 1],
  bowl: ["bowl", 1], bowls: ["bowl", 1],
  glass: ["glass", 1], glasses: ["glass", 1],
  plate: ["plate", 1], plates: ["plate", 1],
  handful: ["handful", 1], handfuls: ["handful", 1],
  slice: ["slice", 1], slices: ["slice", 1],
  piece: ["piece", 1], pieces: ["piece", 1], pc: ["piece", 1], pcs: ["piece", 1],
};

const UNICODE_FRAC = { "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875, "⅙": 1 / 6, "⅚": 5 / 6, "⅕": 0.2, "⅖": 0.4, "⅗": 0.6, "⅘": 0.8 };
const FRAC_CHARS = Object.keys(UNICODE_FRAC).join("");

const WORD_NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, half: 0.5, dozen: 12 };

const PREP_WORDS = /\b(chopped|diced|minced|sliced|grated|shredded|crushed|ground|fresh|freshly|finely|roughly|coarsely|peeled|deseeded|seeded|cooked|raw|boiled|fried|roasted|toasted|warm|cold|hot|large|small|medium|ripe|optional|softened|melted|beaten|washed|rinsed|drained|trimmed|halved|quartered|cubed|pinch|pinches|dash|of)\b/gi;

function extractQty(s) {
  let m;
  if ((m = s.match(new RegExp(`^(\\d+)\\s*([${FRAC_CHARS}])\\s*(.*)$`)))) return { qty: Number(m[1]) + UNICODE_FRAC[m[2]], rest: m[3] };
  if ((m = s.match(new RegExp(`^([${FRAC_CHARS}])\\s*(.*)$`)))) return { qty: UNICODE_FRAC[m[1]], rest: m[2] };
  if ((m = s.match(/^(\d+)\s+(\d+)\/(\d+)\s*(.*)$/))) return { qty: Number(m[1]) + Number(m[2]) / Number(m[3]), rest: m[4] };
  if ((m = s.match(/^(\d+)\/(\d+)\s*(.*)$/))) return { qty: Number(m[1]) / Number(m[2]), rest: m[3] };
  if ((m = s.match(/^(\d*\.?\d+)\s*(?:-|–|to)\s*(\d*\.?\d+)\s*(.*)$/))) return { qty: (Number(m[1]) + Number(m[2])) / 2, rest: m[3] };
  if ((m = s.match(/^(\d*\.?\d+)\s*(.*)$/))) return { qty: Number(m[1]), rest: m[2] };
  if ((m = s.match(/^([a-z]+)\b\s*(.*)$/i)) && WORD_NUM[m[1].toLowerCase()] != null) return { qty: WORD_NUM[m[1].toLowerCase()], rest: m[2] };
  return { qty: null, rest: s };
}

function extractUnit(s) {
  const m = s.match(/^([a-zA-Z]+)\.?\b\s*(.*)$/);
  if (m) {
    const hit = UNIT_MAP[m[1].toLowerCase()];
    if (hit) return { unit: hit[0], factor: hit[1], rest: m[2] };
  }
  return { unit: null, factor: 1, rest: s };
}

function cleanName(s) {
  let name = s.replace(/\([^)]*\)/g, " ");          // drop parentheticals
  name = name.split(/,|;| - | – | to taste| for /i)[0]; // drop trailing prep notes
  name = name.replace(PREP_WORDS, " ");
  name = name.replace(/[^a-zA-Z\s'&-]/g, " ");       // strip digits/stray punctuation
  return name.replace(/\s+/g, " ").trim();
}

function detectServings(text) {
  const m = text.match(/serves?\s+(\d+)/i) || text.match(/makes?\s+(\d+)/i) || text.match(/(\d+)\s+servings?/i) || text.match(/yields?\s+(\d+)/i);
  if (m) { const n = Math.round(Number(m[1])); if (n > 0 && n <= 50) return n; }
  return 1;
}

export function parseRecipeLocal(text) {
  const raw = String(text || "");
  let lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  // single blob with commas -> treat commas as line breaks
  if (lines.length <= 1 && raw.includes(",")) lines = raw.split(",").map(l => l.trim()).filter(Boolean);

  const out = [];
  for (const line of lines) {
    if (/[:：]\s*$/.test(line)) continue;             // section header ("For the sauce:")
    const { qty, rest } = extractQty(line);
    const afterUnit = extractUnit(rest);
    const ingredient_guess = cleanName(afterUnit.rest);
    if (!ingredient_guess) continue;
    // qty-less long lines are almost certainly instructions, not ingredients
    if (qty == null && ingredient_guess.split(" ").length > 6) continue;
    const qtyScaled = qty != null ? qty * afterUnit.factor : null;
    out.push({
      raw_text: line.slice(0, 200),
      qty: Number.isFinite(qtyScaled) && qtyScaled > 0 ? qtyScaled : null,
      unit: afterUnit.unit && ALLOWED_UNITS.has(afterUnit.unit) ? afterUnit.unit : null,
      ingredient_guess: ingredient_guess.slice(0, 120),
    });
  }
  return { servings: detectServings(raw), lines: out };
}
