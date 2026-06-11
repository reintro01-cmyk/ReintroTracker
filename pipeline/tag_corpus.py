#!/usr/bin/env python3
"""Tag the 625 CORPUS recipes with slot / phase / required_safe_foods so the planner
can use them. Emits UPDATE statements keyed by the same slug load_recipes.py generated.

  slot   : classified from recomputed per-100g macros (+ name heuristics)
  phase  : 'reintro' (corpus dishes use varied, post-detox foods)
  req    : app food IDs for ingredients that map back to one of the 121 tracked foods
"""
import json, os, sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "pipeline"))
from ingest_ifct import load_ifct, transform, match_app_foods, load_app_foods
from extract_recipes import norm
from load_recipes import slugify

OUT = os.path.join(ROOT, "pipeline/out/corpus_tags.sql")
RECIPES = json.load(open(os.path.join(ROOT, "pipeline/out/recipes_mapped.json")))

# canonical IFCT name (normalized) -> app food id, for the foods that matched IFCT
app_foods = load_app_foods()
_, recs = load_ifct()
matches = match_app_foods(app_foods, transform(_, recs))
canon2app = {norm(m["ifct"]["name"]): m["app"]["id"] for m in matches if m["ifct"]}

BEV = ("tea", "coffee", "juice", "lassi", "smoothie", "shake", "soup", "rasam",
       "buttermilk", "chaas", "water", "sharbat", "drink", "milkshake", "kanji",
       "hot chocolate", "mojito", "cooler", "punch", "iced")
# desserts/sweets must NOT land in the Fat slot (a fat-meal is a fat shot, not a cake)
SWEET = ("cake", "pie", "ice cream", "icecream", "kheer", "halwa", "barfi", "burfi",
         "laddu", "ladoo", "jalebi", "gulab jamun", "cookie", "brownie", "muffin",
         "pudding", "custard", "tart", "pastry", "candy", "fudge", "mousse",
         "cheesecake", "payasam", "dessert", "rabri", "sandesh", "rasgulla", "swiss roll")


def classify_slot(c, name):
    nm = name.lower()
    if any(w in nm for w in SWEET):
        return "vegcarb"               # desserts are carb-heavy; never the fat-meal slot
    if any(w in nm for w in BEV):
        return "fibre"
    if not c or not c.get("kcal"):
        return "vegcarb"
    k = c["kcal"]
    if k < 40:
        return "fibre"
    ff = 9 * (c.get("fat") or 0) / k
    pf = 4 * (c.get("protein") or 0) / k
    cf = 4 * (c.get("carb") or 0) / k
    # density guards: a slot's role implies a minimum calorie density, else it's a light dish
    if ff > 0.6 and k >= 150:
        return "fat"
    if pf > 0.28 and cf < 0.35 and k >= 60:
        return "protein"
    if pf > 0.20 and cf > 0.35 and k >= 90:   # proteincarb = substantial combined meal
        return "proteincarb"
    return "vegcarb"


def lit(s):
    return "'" + str(s).replace("'", "''") + "'"


seen, slots, rsf_hist, vals = set(), Counter(), [], []
for r in RECIPES:
    slug = slugify(r["name"]) or "recipe"
    if slug in seen:
        slug += "-" + str(len(seen))
    seen.add(slug)
    slot = classify_slot(r.get("computed_per100g"), r["name"])
    slots[slot] += 1
    rsf = sorted({canon2app[norm(i["matched"])] for i in r["ingredients"]
                  if i.get("matched") and norm(i["matched"]) in canon2app})
    rsf_hist.append(len(rsf))
    arr = "ARRAY[" + ",".join(lit(a) for a in rsf) + "]::text[]" if rsf else "'{}'::text[]"
    vals.append(f"({lit(slug)},{lit(slot)},{arr})")

# one set-based UPDATE — fast + single short lock (725 separate UPDATEs were lock-fragile)
out = ["begin;",
       "update recipes r set slot=v.slot, phase='reintro', required_safe_foods=v.rsf",
       "from (values\n" + ",\n".join(vals) + "\n) as v(slug, slot, rsf)",
       "where r.slug = v.slug and r.source_id = 'CORPUS';",
       "commit;"]
open(OUT, "w").write("\n".join(out))

print("slot distribution:", dict(slots))
print(f"avg required_safe_foods/recipe: {sum(rsf_hist)/len(rsf_hist):.1f}  "
      f"(recipes with >=1 mapped food: {sum(1 for x in rsf_hist if x)}/{len(rsf_hist)})")
print(f"SQL -> {os.path.relpath(OUT, ROOT)}")
