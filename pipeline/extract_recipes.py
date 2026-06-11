#!/usr/bin/env python3
"""Extract File 2 (Kaggle Indian recipe corpus) into facts-only recipe records,
map each ingredient to our IFCT+USDA canonical set, and recompute per-100g nutrition
from OUR tables (their stated numbers are unreliable — e.g. a chicken soup at 28 kcal).

FACTS ONLY: ingredient lists + quantities are extracted; the source's method prose is
NOT copied (to be rewritten later). Nutrition is recomputed, never taken from the file.

Nutrition here is APPROXIMATE: it uses a generic unit->gram table. Trustworthy values
need the per-ingredient `measures` table — this run quantifies how close generic gets
and surfaces the ingredients that still need mapping.
"""
import csv, json, os, re, difflib

csv.field_size_limit(10_000_000)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
import sys; sys.path.insert(0, os.path.join(ROOT, "pipeline"))
from ingest_ifct import load_ifct, transform
from ingest_usda import load_dataset, DATASETS
from measures import grams_of, added_water_g, UNIT_G

RECIPES_CSV = "/tmp/ifct_check/kag/Indian_Food_Ingredients_Nutrition_CookingMethods.csv"
OUT_JSON = os.path.join(ROOT, "pipeline/out/recipes_mapped.json")
OUT_RPT  = os.path.join(ROOT, "pipeline/out/recipe_coverage.md")

# recipe ingredient term -> a token that exists in our canonical names
ING_ALIASES = {
    "besan": "bengal gram", "gram flour": "bengal gram", "kasuri methi": "fenugreek leaves",
    "dried fenugreek leaves": "fenugreek leaves", "methi": "fenugreek leaves",
    "hing": "asafoetida", "jeera": "cumin", "elaichi": "cardamom", "dhania": "coriander",
    "palak": "spinach", "urad dal": "black gram", "white urad dal": "black gram",
    "moong dal": "green gram", "toor dal": "red gram", "chana dal": "bengal gram",
    "masoor dal": "lentil", "rajma": "rajmah", "curd": "yogurt", "dahi": "yogurt",
    "corn flour": "corn starch", "cornflour": "corn starch", "maida": "wheat flour, refined",
    "atta": "wheat flour, atta", "peppercorns": "pepper, black", "black peppercorns": "pepper, black",
    "green chillies": "chillies, green", "green chilli": "chillies, green",
    "red chilli powder": "chillies, red", "ghee": "ghee", "paneer": "paneer",
    "spring onion greens": "onion", "spring onion": "onion", "coriander leaves": "coriander leaves",
    # high-frequency synonyms found in the unmatched queue
    "olive oil": "oil, olive", "badam": "almond", "kabuli chana": "bengal gram",
    "kala chana": "bengal gram", "poha": "rice flakes", "kaddu": "pumpkin",
    "bell pepper": "capsicum", "bell peppers": "capsicum", "pistachios": "pista",
    "rolled oats": "oats", "instant oats": "oats", "sooji": "wheat, semolina",
    # eggplant guard MUST precede the egg aliases (first substring match wins)
    "eggplant": "brinjal-1", "brinjal": "brinjal-1",
    "whole eggs": "egg, poultry, whole", "whole egg": "egg, poultry, whole",
    "eggs": "egg, poultry, whole", "egg": "egg, poultry, whole",
}

# modifier words that must NOT drive a token match (cause "whole eggs" -> "wheat, whole")
STOP = {"whole", "fresh", "dried", "raw", "chopped", "ground", "fine", "finely", "grated",
        "sliced", "cubed", "crushed", "peeled", "powder", "powdered", "for", "and", "the",
        "of", "to", "with", "or", "a", "large", "small", "medium", "ripe", "boiled",
        "cooked", "roasted", "extra", "virgin", "instant", "leaves", "leaf"}

ZERO = ("salt", "water", "taste", "baking soda", "food color")  # ~0 kcal / handled as 0


def norm(s):
    s = s.lower()
    s = re.sub(r"\(.*?\)", " ", s)            # drop parentheticals
    s = s.split(" - ")[0]                      # drop "- chopped" prep notes
    return re.sub(r"\s+", " ", s).strip(" .,-")


def build_index():
    """name(normalized) -> {kcal,protein,fat,carb,fibre,source}. IFCT preferred."""
    idx = {}
    _, recs = load_ifct()
    for f in transform(_, recs):
        idx[norm(f["name"])] = {"kcal": f["kcal"], "protein": f["protein"], "fat": f["fat"],
                                "carb": f["carb"], "fibre": f["fibre"], "source": "IFCT"}
    for d, src, dt in DATASETS:
        if not os.path.isdir(d):
            continue
        for fid, f in load_dataset(d, dt).items():
            k = norm(f["desc"]); nu = f.get("n", {})
            if k and k not in idx and nu.get("kcal") is not None:
                idx[k] = {"kcal": nu.get("kcal"), "protein": nu.get("protein"), "fat": nu.get("fat"),
                          "carb": nu.get("carb"), "fibre": nu.get("fibre"), "source": src}
    return idx


def match_ing(name, keys, keyset):
    n = norm(name)
    for term, target in ING_ALIASES.items():
        if term in n:
            n = target; break
    if n in keyset:
        return n, "exact"
    pref = [k for k in keys if k.startswith(n + ", ") or k.startswith(n + " ") or k == n]
    if pref:
        return min(pref, key=len), "prefix"
    toks = set(n.split()) - STOP                     # ignore modifiers when matching
    best, bestov = None, 0
    for k in keys:
        ov = len(toks & (set(k.split()) - STOP))
        if ov > bestov:
            best, bestov = k, ov
    if bestov >= 1 and len(toks) <= 3:
        return best, "token"
    cand = difflib.get_close_matches(n, keys, n=1, cutoff=0.9)
    return (cand[0], "fuzzy") if cand else (None, "unmatched")


FRAC = {"½": .5, "¼": .25, "¾": .75, "⅓": 1/3, "⅔": 2/3}
def parse_qty(line):
    s = line.strip()
    for g, v in FRAC.items():
        s = s.replace(g, " " + str(round(v, 3)))
    m = re.match(r"^\s*(\d+\s*-\s*\d+/\d+|\d+/\d+|\d+\.?\d*)\s*", s)
    qty = None
    if m:
        tok = m.group(1).replace(" ", "")
        try:
            if "-" in tok and "/" in tok:           # mixed "2-1/2"
                whole, frac = tok.split("-"); a, b = frac.split("/")
                qty = float(whole) + float(a) / float(b)
            elif "/" in tok:
                a, b = tok.split("/"); qty = float(a) / float(b)
            else:
                qty = float(tok)
        except (ValueError, ZeroDivisionError):
            qty = None
        s = s[m.end():]
    parts = s.split()
    parse_units = set(UNIT_G) | {"cup", "cups"}
    unit = parts[0].lower() if parts and parts[0].lower() in parse_units else None
    name = " ".join(parts[1:]) if unit else " ".join(parts)
    return qty, unit, name.strip()


def main():
    idx = build_index()
    keys = list(idx); keyset = set(keys)
    rows = list(csv.DictReader(open(RECIPES_CSV, encoding="utf-8")))
    out, occ, matched_occ, fully = [], 0, 0, 0
    unmatched_counter = {}
    for r in rows:
        lines = [x for x in r["TranslatedIngredients"].split(",") if x.strip()]
        ings, tot_g, mac = [], 0.0, {"kcal": 0, "protein": 0, "fat": 0, "carb": 0, "fibre": 0}
        n_match = 0
        for ln in lines:
            qty, unit, nm = parse_qty(ln)
            if not nm or not norm(nm):          # skip prep-only lines ("- to taste")
                continue
            occ += 1
            if any(z in nm.lower() for z in ZERO):
                ings.append({"raw": ln.strip(), "name": nm, "matched": "(zero-cal)", "conf": "exact"})
                n_match += 1; matched_occ += 1
                continue
            mk, conf = match_ing(nm, keys, keyset)
            g = grams_of(qty, unit, nm)
            rec = {"raw": ln.strip(), "qty": qty, "unit": unit, "name": nm,
                   "matched": mk, "source": idx.get(mk, {}).get("source"), "grams": round(g, 1), "conf": conf}
            ings.append(rec)
            if mk:
                n_match += 1; matched_occ += 1
                v = idx[mk]; tot_g += g
                for kk in mac:
                    if v.get(kk) is not None:
                        mac[kk] += g / 100 * v[kk]
            else:
                unmatched_counter[norm(nm)] = unmatched_counter.get(norm(nm), 0) + 1
        denom = tot_g + added_water_g(r["final_food_name"], tot_g)   # cooking water for soups/curries
        per100 = {k: round(mac[k] / denom * 100, 1) for k in mac} if denom else None
        pct = round(n_match / len(ings) * 100) if ings else 0
        if pct == 100:
            fully += 1
        out.append({"name": r["final_food_name"], "cuisine": r["Cuisine"],
                    "time_mins": r["TotalTimeInMins"], "ingredients": ings,
                    "computed_per100g": per100, "mapped_pct": pct,
                    "stated_kcal_unreliable": r["Calories (kcal)"]})
    json.dump(out, open(OUT_JSON, "w"), indent=1)

    top_un = sorted(unmatched_counter.items(), key=lambda x: -x[1])[:30]
    L = ["# Recipe Extraction & Ingredient Mapping — File 2\n",
         f"**Recipes parsed:** {len(out)}  |  **Ingredient occurrences:** {occ}  |  "
         f"**Mapped:** {matched_occ} ({round(matched_occ/occ*100)}%)  |  "
         f"**Recipes 100% mapped:** {fully}\n",
         "## Sample recomputed recipes (per 100g, from OUR tables)\n",
         "| Recipe | Cuisine | mapped% | kcal | P | F | C | Fibre |",
         "|---|---|--:|--:|--:|--:|--:|--:|"]
    for rec in out[:12]:
        c = rec["computed_per100g"] or {}
        L.append(f"| {rec['name'][:34]} | {rec['cuisine'][:16]} | {rec['mapped_pct']} | "
                 f"{c.get('kcal','—')} | {c.get('protein','—')} | {c.get('fat','—')} | "
                 f"{c.get('carb','—')} | {c.get('fibre','—')} |")
    L.append(f"\n## Top unmatched ingredients ({len(unmatched_counter)} distinct) — alias-curation queue\n")
    L.append(" | ".join(f"{n}×{c}" for n, c in top_un))
    open(OUT_RPT, "w").write("\n".join(L))

    print(f"recipes parsed     : {len(out)}")
    print(f"ingredient occurr. : {occ}")
    print(f"mapped occurrences : {matched_occ} ({round(matched_occ/occ*100)}%)")
    print(f"recipes 100% mapped: {fully}")
    print(f"distinct unmatched : {len(unmatched_counter)}")
    print(f"JSON  -> {os.path.relpath(OUT_JSON, ROOT)}")
    print(f"report-> {os.path.relpath(OUT_RPT, ROOT)}")


if __name__ == "__main__":
    main()
