#!/usr/bin/env python3
"""Build-time export: DB recipes -> src/data/recipes.js (the app's RECIPES array).

Corpus nutrition is per-100g; convert to per-serving using per-slot default serving
sizes. Curated nutrition is already per-serving (per='serving') and passes through.
The DB is the source of truth; this file is a generated cache — re-run to refresh.
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "pipeline/out/recipes_export.json")
OUT = os.path.join(ROOT, "src/data/recipes.js")

# per-slot default serving sizes (grams) — first-pass; refine with real servings later
SERVING_G = {"fat": 40, "protein": 150, "vegcarb": 130, "proteincarb": 250, "fibre": 240}
# Sane-portion energy ceilings (kcal/serving). The fixed per-slot servings above over-scale
# dense dishes (e.g. concentrated dal -> 800 kcal). Until real serving weights are ingested,
# clamp the whole serving (kcal + macros together) down proportionally so portions stay
# plausible. Desserts are a smaller treat portion.
MAX_SERVING_KCAL = {"dessert": 500, "meal": 600}
PLACEHOLDER = "Auto-generated recipe — cooking method pending generation."

# Desserts/sweets are categorised out of the meal-slot planner and surfaced in their own
# Favourites > Desserts section. Keep this list in sync with SWEET in tag_corpus.py.
SWEET = ("cake", "pie", "ice cream", "icecream", "kheer", "halwa", "barfi", "burfi",
         "laddu", "ladoo", "jalebi", "gulab jamun", "cookie", "brownie", "muffin",
         "pudding", "custard", "tart", "pastry", "candy", "fudge", "mousse",
         "cheesecake", "payasam", "dessert", "rabri", "sandesh", "rasgulla", "swiss roll")


def is_dessert(name):
    nm = (name or "").lower()
    return any(w in nm for w in SWEET)


def rnd(v, d=0):
    return round(v, d) if isinstance(v, (int, float)) else v


def main():
    rows = json.load(open(SRC))
    out = []
    for r in rows:
        per100 = r["per"] == "per_100g"
        sg = SERVING_G.get(r["slot"] or "vegcarb", 150)
        factor = sg / 100 if per100 else 1.0

        category = "dessert" if is_dessert(r["name"]) else "meal"
        # clamp to a sane per-serving energy by shrinking the whole serving proportionally
        raw_kcal = (r["kcal"] or 0) * factor
        cap = MAX_SERVING_KCAL[category]
        if raw_kcal > cap:
            factor *= cap / raw_kcal

        def conv(v, dec=0):
            return rnd((v or 0) * factor, dec)

        ingredients = [{"name": s, "qty": ""} for s in (r.get("ings") or []) if s]
        out.append({
            "id": r["slug"],
            "name": r["name"],
            "slot": r["slot"] or "vegcarb",
            "phase": r["phase"] or "reintro",
            "requiredSafeFoods": r.get("rsf") or [],
            "kcal": int(conv(r["kcal"])),
            "macros": {
                "fat": int(conv(r["f"])),
                "carbs": int(conv(r["c"])),
                "protein": int(conv(r["p"])),
                "fibre": int(conv(r["fib"])),
            },
            "prepMins": r.get("prepmins") or None,
            "ingredients": ingredients,
            "method": r["method"] if r["method"] else PLACEHOLDER,
            "tags": [t.strip() for t in (r.get("tagline") or "").split(",") if t.strip()],
            "source": r["source_id"],
            "category": category,
        })

    # stable order: curated first, then by slot, then name
    slot_rank = {"fat": 0, "protein": 1, "proteincarb": 2, "vegcarb": 3, "fibre": 4}
    out.sort(key=lambda x: (x["source"] != "CURATED", slot_rank.get(x["slot"], 9), x["name"]))

    body = json.dumps(out, indent=2, ensure_ascii=False)
    header = ("// AUTO-GENERATED from the Supabase nutrition DB by pipeline/format_recipes.py.\n"
              "// Do NOT edit by hand — the database is the source of truth; re-run the export to refresh.\n"
              "// Corpus nutrition converted per-100g -> per-serving via per-slot default servings.\n\n"
              "export const RECIPES = ")
    open(OUT, "w", encoding="utf-8").write(header + body + ";\n")

    from collections import Counter
    print(f"wrote {len(out)} recipes -> src/data/recipes.js")
    print("by source:", dict(Counter(x["source"] for x in out)))
    print("by slot  :", dict(Counter(x["slot"] for x in out)))
    print("desserts :", sum(1 for x in out if x["category"] == "dessert"))
    print("missing method (corpus):", sum(1 for x in out if x["method"] == PLACEHOLDER))


if __name__ == "__main__":
    main()
