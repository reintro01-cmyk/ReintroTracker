#!/usr/bin/env python3
"""Validate File 1 (INDB, 1,014 composite dishes) and settle its unit basis.

Two checks:
  1. Standalone sanity — Atwater consistency (kcal vs 9F+4C+4P) + impossible-macro flags.
  2. Cross-check vs OUR measures-based recompute (recipes_mapped.json) for name-matched
     dishes — the kcal RATIO reveals whether File 1 is per-100g (~1.0) or per-serving (~2-3).

Run after extract_recipes.py (needs pipeline/out/recipes_mapped.json).
"""
import csv, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILE1 = "/tmp/ifct_check/kag/Indian_Food_Nutrition_Processed.csv"
RECIPES = os.path.join(ROOT, "pipeline/out/recipes_mapped.json")
OUT = os.path.join(ROOT, "pipeline/out/indb_validation.md")


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def norm(s):
    s = re.sub(r"\(.*?\)", " ", s.lower())
    return re.sub(r"\s+", " ", s).strip(" .,-")


def main():
    rows = list(csv.DictReader(open(FILE1, encoding="utf-8")))
    flags = {"atwater": [], "impossible_sum": [], "extreme_macro": []}
    parsed = []
    for r in rows:
        nm = r["Dish Name"]
        kcal = num(r["Calories (kcal)"]); carb = num(r["Carbohydrates (g)"])
        prot = num(r["Protein (g)"]); fat = num(r["Fats (g)"]); fib = num(r["Fibre (g)"]) or 0
        if None in (kcal, carb, prot, fat) or kcal <= 0:
            continue
        parsed.append({"name": nm, "kcal": kcal, "carb": carb, "prot": prot, "fat": fat})
        atw = 4 * carb + 4 * prot + 9 * fat
        if abs(atw - kcal) > 20 and abs(atw - kcal) / kcal > 0.15:
            flags["atwater"].append((nm, kcal, round(atw)))
        if carb + prot + fat + fib > 105:
            flags["impossible_sum"].append((nm, round(carb + prot + fat + fib)))
        if fat > 60 or carb > 95 or prot > 55:
            flags["extreme_macro"].append((nm, f"F{fat} C{carb} P{prot}"))

    # cross-check vs our recompute (per 100g)
    ours = {norm(x["name"]): x["computed_per100g"] for x in json.load(open(RECIPES))
            if x.get("computed_per100g")}
    ratios = []
    examples = []
    for p in parsed:
        o = ours.get(norm(p["name"]))
        if o and o.get("kcal"):
            ratio = p["kcal"] / o["kcal"]
            ratios.append(ratio)
            if len(examples) < 12:
                examples.append((p["name"], p["kcal"], o["kcal"], round(ratio, 2)))
    med = sorted(ratios)[len(ratios) // 2] if ratios else None
    within25 = sum(1 for r in ratios if 0.75 <= r <= 1.25)
    within50 = sum(1 for r in ratios if 0.5 <= r <= 1.5)
    pct25 = round(within25 / len(ratios) * 100) if ratios else 0
    pct50 = round(within50 / len(ratios) * 100) if ratios else 0

    L = ["# INDB (File 1) Validation\n",
         f"**Dishes validated:** {len(parsed)}  |  "
         f"**Atwater-inconsistent:** {len(flags['atwater'])}  |  "
         f"**Impossible macro-sum (>105g/100g):** {len(flags['impossible_sum'])}  |  "
         f"**Extreme single macro:** {len(flags['extreme_macro'])}\n"]
    L.append("## Basis check — File 1 kcal ÷ our recomputed per-100g kcal\n")
    L.append(f"Name-matched dishes: **{len(ratios)}**  |  **median ratio: {round(med,2) if med else 'n/a'}**")
    L.append("(ratio ≈ 1.0 ⇒ File 1 is per-100g; ratio ≈ 2–3 ⇒ per-serving)\n")
    L.append("| Dish | File1 kcal | our kcal/100g | ratio |")
    L.append("|---|--:|--:|--:|")
    for nm, a, b, rt in examples:
        L.append(f"| {nm[:40]} | {a} | {b} | {rt} |")
    L.append(f"\n## Atwater-inconsistent ({len(flags['atwater'])}) — kcal doesn't match macros\n")
    for nm, k, a in flags["atwater"][:15]:
        L.append(f"- {nm[:50]}: stated {k} vs Atwater {a}")
    L.append(f"\n## Impossible macro-sum >105 g/100g ({len(flags['impossible_sum'])}) — only valid if per-serving\n")
    for nm, s in flags["impossible_sum"][:15]:
        L.append(f"- {nm[:50]}: macros sum to {s} g")
    open(OUT, "w").write("\n".join(L))

    print(f"dishes validated      : {len(parsed)}")
    print(f"atwater-inconsistent  : {len(flags['atwater'])}")
    print(f"impossible macro-sum  : {len(flags['impossible_sum'])}")
    print(f"extreme single macro  : {len(flags['extreme_macro'])}")
    print(f"name-matched vs ours  : {len(ratios)}  median ratio: {round(med,2) if med else 'n/a'}")
    print(f"within +-25% of INDB  : {pct25}%   within +-50%: {pct50}%")
    print(f"report-> {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()
