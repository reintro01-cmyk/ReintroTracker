// Shared recipe classification for the build scripts (build_recipe_library.mjs +
// build_recipe_ideas.mjs). Keeps tab/diet/gating logic identical across the default
// library (CURATED + COMMUNITY) and the on-demand idea set (CORPUS).
import { DEFAULT_FOODS } from "../src/data/foods.js";

// Gate recipes to the user's TRACKED reintroduction foods. Match on each food's name +
// distinctive words (dropping generic qualifiers). Only the major reintroduction groups
// gate — spices/oils/condiments are background and would lock every recipe.
const GATE_GROUPS = new Set(["Dairy", "Grains / carbs", "Animal protein", "Dals / pulses / nuts / seeds"]);
const QUALIFIER = new Set(["white", "brown", "red", "green", "grilled", "plain", "fresh", "raw", "cooked", "small", "large", "dried", "whole", "skinless", "boiled"]);
// shared group-suffix words: matching on these lumps every dal/seed/etc. together.
const GENERIC = new Set(["dal", "seed", "seeds", "powder", "oil", "flour", "gram", "masala", "sauce", "paste", "nuts", "nut", "lentil", "pulse", "leaves", "leaf", "cheese"]);
const FOOD_TERMS = DEFAULT_FOODS.filter(f => GATE_GROUPS.has(f.group)).map(f => {
  const words = f.name.toLowerCase().split(/[\s/]+/).filter(w => w.length >= 3 && !QUALIFIER.has(w) && !GENERIC.has(w));
  const terms = [...new Set([f.name.toLowerCase().replace(/\s*\/\s*/g, " "), ...words])].filter(Boolean);
  return { id: f.id, res: terms.map(t => new RegExp(`\\b${t.replace(/[^a-z0-9 ]/g, "")}\\b`, "i")) };
});

export function requiredFoodsFor(ingredients) {
  const hay = ingredients.join(" ").toLowerCase();
  return FOOD_TERMS.filter(f => f.res.some(re => re.test(hay))).map(f => f.id);
}

const has = (s, words) => words.some(w => s.includes(w));
const DESSERT = ["dessert", "halwa", "kheer", "payasam", "ladoo", "laddu", "burfi", "barfi", "cake", "pudding", "sweet", "mithai", "jamun", "sandesh", "phirni", "custard", "cookie", "brownie", "mousse", "ice cream"];
const SUGARY = ["sugar", "jaggery", "gur ", "honey", "caster", "condensed milk", "syrup"];
const BREAKFAST = ["oats", "poha", "upma", "idli", "dosa", "uttapam", "chilla", "cheela", "smoothie", "pancake", "paratha", "porridge", "muesli", "granola", "omelet", "omelette", "scramble", "pongal", "dalia", "thalipeeth", "breakfast", "cornflakes", "egg white"];
const SNACK = ["soup", "salad", "chaat", "tikki", "cutlet", "fritter", "pakora", "bhel", "sprout", "makhana", "roast", "dip", "raita", "chutney", "juice", "buttermilk", "chaas", "balls", "bar", "kebab", "snack", "roll", "sandwich", "toast", "shake", "tea", "coffee", "water"];
const MAIN = ["curry", "sabzi", "subzi", "dal", "rice", "roti", "biryani", "pulao", "khichdi", "gravy", "masala", "kootu", "poriyal", "thoran", "sambar", "rasam", "stew", "paneer", "chicken", "fish", "bharta", "bhaji", "kadhi", "sauté", "saute", "pathiri", "bowl", "pasta", "noodles", "chopsuey"];

const NONVEG = ["chicken", "fish", "egg", "eggs", "mutton", "lamb", "beef", "pork", "prawn", "prawns", "shrimp", "crab", "tuna", "salmon", "anchovy", "squid", "seafood", "meat", "ham", "bacon", "turkey", "duck"];
const hasWord = (s, words) => new RegExp(`\\b(${words.join("|")})\\b`, "i").test(s);

export function classify(name, ingredients, kcal) {
  const hay = (name + " " + ingredients.join(" ")).toLowerCase();
  if (has(hay, DESSERT)) return { mealTypes: ["dessert"], dessert: true };
  const mt = new Set();
  if (has(hay, BREAKFAST)) mt.add("breakfast");
  if (has(hay, SNACK)) mt.add("snack");
  if (has(hay, MAIN)) mt.add("mains");
  if (mt.size === 0) mt.add(Number(kcal) > 0 && Number(kcal) < 180 ? "snack" : "mains");  // fallback by calories
  return { mealTypes: [...mt], dessert: false };
}

// Neutralise vegetarian terms that embed a non-veg keyword before matching:
// "egg plant" (egg), "coconut meat" (meat), "meat substitute/-free/-less".
export const isVeg = (name, ingredients) =>
  !hasWord(
    (name + " " + ingredients.join(" ")).toLowerCase()
      .replace(/egg[\s-]?plant/g, "eggplant")
      .replace(/coconut\s+meat/g, "coconut")
      .replace(/meat\s*(substitute|free|less|alternative)/g, "mock"),
    NONVEG
  );

export const isSugarFree = (name, ingredients) =>
  !has((name + " " + ingredients.join(" ")).toLowerCase(), SUGARY);
