#!/usr/bin/env python3
"""Transform the IFCT 2017 MIT dataset into the nutrition schema, validate it,
and map the app's 121 foods against it.

Inputs : pipeline/data/ifct_compositions.csv  (vendored, MIT)
         src/data/foods.js                     (the app's 121 foods)
Outputs: pipeline/out/ifct_ingredients.sql     (loadable INSERTs for all IFCT foods)
         pipeline/out/coverage_report.md        (121-food coverage + Atwater flags)

Energy is converted kJ -> kcal (/4.184). carb = available carbohydrate (choavldf);
fibre kept separate (fibtg). Per-nutrient uncertainty (_e cols) is preserved.
"""
import csv, json, re, difflib, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IFCT_CSV  = os.path.join(ROOT, "pipeline/data/ifct_compositions.csv")
FOODS_JS  = os.path.join(ROOT, "src/data/foods.js")
OUT_SQL   = os.path.join(ROOT, "pipeline/out/ifct_ingredients.sql")
OUT_REPORT= os.path.join(ROOT, "pipeline/out/coverage_report.md")

KJ_PER_KCAL = 4.184
MACRO = {"enerc": "energy", "fatce": "fat", "fibtg": "fibre",
         "choavldf": "carb", "protcnt": "protein", "water": "water"}

# Indian -> IFCT term bridges where the names diverge lexically.
# Values are exact lowercased IFCT canonical names (verified against the dataset).
ALIASES = {
    # dals / pulses
    "moong dal": "green gram, dal", "toor dal": "red gram, dal",
    "urad dal": "black gram, dal", "channa dal": "bengal gram, dal",
    "masoor dal": "lentil dal", "rajma / kidney beans": "rajmah, red",
    "chickpeas / white channa": "bengal gram, whole", "black channa": "bengal gram, whole",
    "whole green gram": "green gram, whole", "cowpea / lobia": "cowpea, brown",
    "horse gram / kollu": "horse gram, whole", "peanuts": "ground nut", "cashews": "cashew nut",
    # grains / millets
    "white rice": "rice, raw, milled", "poha / aval": "rice flakes",
    "wheat / chapati": "wheat flour, atta", "rava / upma": "wheat, suji",
    "maida / refined flour": "wheat flour, refined", "kambu / pearl millet": "bajra",
    "saamai / little millet": "samai",
    # dairy
    "cow's milk": "milk, whole, cow",
    # oils
    "coconut oil": "coconut oil", "groundnut oil": "groundnut oil",
    "sesame / gingelly oil": "gingelly oil", "mustard oil": "mustard oil",
    "sunflower oil": "sunflower oil", "ghee": "ghee",
    # vegetables
    "onion": "onion, big", "tomato": "tomato, ripe, local", "potato": "potato, brown skin, big",
    "carrot": "carrot, orange", "cabbage": "cabbage, green", "cucumber": "cucumber, green, short",
    "radish": "radish, elongate, white skin", "pumpkin": "pumpkin, orange, round",
    "sweet potato": "sweet potato, brown skin", "okra / ladies finger": "ladies finger",
    "brinjal / eggplant": "brinjal-1",
    # fruits
    "banana": "banana, ripe, montham", "apple": "apple, big", "mango": "mango, ripe, banganapalli",
    "papaya": "papaya, ripe", "guava": "guava, white flesh", "peas": "peas, fresh",
    # spices
    "garlic": "garlic, big clove", "black pepper": "pepper, black", "cumin / jeera": "cumin seeds",
    "turmeric": "turmeric powder", "green chilli": "chillies, green-1",
    "coriander powder": "coriander seeds", "red chilli powder": "chillies, red",
    # late additions (alias near-misses found in coverage review)
    "watermelon": "water melon, dark green", "rava / upma": "wheat, semolina (suji)",
    "arbi": "colocasia", "sweet corn": "corn, baby",
    # eggs / sweeteners
    "eggs": "egg, poultry, whole, raw", "jaggery": "jaggery, cane",
}


def load_app_foods():
    txt = open(FOODS_JS, encoding="utf-8").read()
    pat = re.compile(r'\{\s*id:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*group:\s*"([^"]+)"')
    return [{"id": i, "name": n, "group": g} for i, n, g in pat.findall(txt)]


def load_ifct():
    rows = list(csv.reader(open(IFCT_CSV, encoding="utf-8")))
    header = [h.split("; ")[-1].strip() for h in rows[0]]
    out = []
    for r in rows[1:]:
        rec = dict(zip(header, r))
        out.append(rec)
    return header, out


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def transform(header, recs):
    """Return normalized food dicts + Atwater validation flags."""
    foods = []
    for rec in recs:
        kj = num(rec.get("enerc"))
        kcal = round(kj / KJ_PER_KCAL, 1) if kj is not None else None
        fat = num(rec.get("fatce")); carb = num(rec.get("choavldf"))
        prot = num(rec.get("protcnt")); fib = num(rec.get("fibtg"))
        # The MIT dataset left energy=0 for every fat/oil. Derive it from macros
        # (Atwater) so oils are usable; flag it so the source of the number is visible.
        energy_derived = False
        if (kcal is None or kcal == 0) and fat and fat > 50:
            atw = 9 * fat + 4 * (carb or 0) + 4 * (prot or 0)
            kcal = round(atw, 1); kj = round(atw * KJ_PER_KCAL, 1)
            energy_derived = True
        # uncertainty band per macro (the _e columns)
        unc = {k: num(rec.get(k + "_e")) for k in MACRO if num(rec.get(k + "_e")) is not None}
        # extended: everything else numeric, excluding _e and the macros we promoted
        promoted = set(MACRO) | {k + "_e" for k in MACRO}
        meta = {"code", "name", "scie", "lang", "grup", "regn", "tags"}
        ext = {}
        for k, v in rec.items():
            if k in promoted or k in meta or k.endswith("_e"):
                continue
            n = num(v)
            if n is not None:
                ext[k] = n
        # Atwater cross-check (4/4/9 + 2 for fibre). Require an absolute floor of
        # 20 kcal so low-calorie vegetables (small absolute gap, large %) don't false-flag.
        flags = []
        if energy_derived:
            flags.append("energy_derived")
        elif None not in (kcal, fat, carb, prot, fib) and kcal and kcal > 0:
            atwater = 4 * prot + 4 * carb + 9 * fat + 2 * fib
            diff = abs(atwater - kcal)
            if diff > 20 and diff / kcal > 0.15:
                flags.append(f"atwater_fail({diff / kcal * 100:.0f}%)")
        elif (kcal is None or kcal == 0) and (fat or carb or prot):
            flags.append("energy_missing")
        conf = "high"
        if energy_derived:
            conf = "medium"
        if any(fl.startswith("atwater_fail") or fl == "energy_missing" for fl in flags):
            conf = "low"
        foods.append({
            "code": rec.get("code"), "name": rec.get("name", "").strip().rstrip(","),
            "scie": rec.get("scie", "").strip(), "grup": rec.get("grup", "").strip(),
            "lang": rec.get("lang", "").strip(),
            "kcal": kcal, "kj": kj, "fat": fat, "carb": carb, "protein": prot,
            "fibre": fib, "water": num(rec.get("water")),
            "uncertainty": unc, "extended": ext, "flags": flags, "confidence": conf,
        })
    return foods


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:60]


def match_app_foods(app_foods, ifct):
    """alias -> exact -> prefix ("X, variant"/"X-n") -> tight fuzzy -> unmatched.
    Prefix matching is semantically safe (no 'pepper'->'snapper'); fuzzy is last
    resort at a high cutoff so wrong matches stay out."""
    by_name = {f["name"].lower(): f for f in ifct}
    names = list(by_name)
    results = []
    for af in app_foods:
        nm = af["name"].lower()
        base = nm.split(" / ")[0].strip()        # 'okra / ladies finger' -> 'okra'
        hit, conf = None, "unmatched"
        if nm in ALIASES and ALIASES[nm] in by_name:
            hit, conf = by_name[ALIASES[nm]], "high(alias)"
        elif base in by_name:
            hit, conf = by_name[base], "high(exact)"
        else:
            pref = [n for n in names if n.startswith(base + ", ")
                    or n.startswith(base + "-") or n.startswith(base + " ")]
            if pref:
                hit, conf = by_name[sorted(pref, key=len)[0]], "medium(prefix)"
            else:
                cand = difflib.get_close_matches(base, names, n=1, cutoff=0.9)
                if cand:
                    hit, conf = by_name[cand[0]], "low(fuzzy)"
        results.append({"app": af, "ifct": hit, "confidence": conf})
    return results


def sql_escape(s):
    return s.replace("'", "''") if s else ""


def lit(s):
    """SQL text literal or null."""
    return "'" + sql_escape(s) + "'" if s else "null"


def litjsonb(obj):
    return "'" + sql_escape(json.dumps(obj)) + "'::jsonb"


def n(v):
    """SQL numeric literal or null."""
    return str(v) if v is not None else "null"


def emit_sql(ifct, path):
    lines = ["-- Generated by pipeline/ingest_ifct.py — IFCT 2017 (MIT) ingredient load.",
             "-- Run AFTER the schema migration. Idempotent on slug / (state,source,version).",
             "begin;"]
    for f in ifct:
        slug = slugify(f["name"]) or f["code"].lower()
        local = litjsonb({"raw": f["lang"]}) if f["lang"] else "null"
        lines.append(
            f"with ing as (\n"
            f"  insert into ingredients (slug, canonical_name, category, scientific_name, local_names)\n"
            f"  values ('{slug}', {lit(f['name'])}, {lit(f['grup'])}, {lit(f['scie'])}, {local})\n"
            f"  on conflict (slug) do update set canonical_name = excluded.canonical_name\n"
            f"  returning id\n"
            f"), st as (\n"
            f"  insert into ingredient_states (ingredient_id, state) select id, 'raw' from ing\n"
            f"  on conflict (ingredient_id, state) do update set state = excluded.state\n"
            f"  returning id\n"
            f")\n"
            f"insert into nutrient_values (ingredient_state_id, source_id, source_food_code, "
            f"energy_kcal, energy_kj, protein_g, fat_g, carb_avail_g, fibre_g, water_g, "
            f"uncertainty, extended, provenance, confidence)\n"
            f"select st.id, 'IFCT-2017', '{f['code']}', "
            f"{n(f['kcal'])}, {n(f['kj'])}, {n(f['protein'])}, {n(f['fat'])}, "
            f"{n(f['carb'])}, {n(f['fibre'])}, {n(f['water'])}, "
            f"{litjsonb(f['uncertainty'])}, {litjsonb(f['extended'])}, "
            f"'measured', '{f['confidence']}' from st\n"
            f"on conflict (ingredient_state_id, source_id, version) do nothing;")
    lines.append("commit;")
    open(path, "w", encoding="utf-8").write("\n".join(lines))


def emit_report(app_foods, ifct, matches, path):
    flagged = [f for f in ifct if f["flags"]]
    matched = [m for m in matches if m["ifct"]]
    unmatched = [m for m in matches if not m["ifct"]]
    L = []
    L.append("# IFCT Ingestion & Coverage Report\n")
    L.append(f"**IFCT foods ingested:** {len(ifct)}  |  "
             f"**App foods matched:** {len(matched)}/{len(app_foods)}  |  "
             f"**Atwater/energy flags:** {len(flagged)}\n")
    L.append("## App food → IFCT coverage\n")
    L.append("| App food | Group | IFCT match | kcal | P | F | C | Fibre | Confidence |")
    L.append("|---|---|---|--:|--:|--:|--:|--:|---|")
    for m in matches:
        af, hit, c = m["app"], m["ifct"], m["confidence"]
        if hit:
            L.append(f"| {af['name']} | {af['group']} | {hit['name']} ({hit['code']}) | "
                     f"{hit['kcal']} | {hit['protein']} | {hit['fat']} | {hit['carb']} | {hit['fibre']} | {c} |")
        else:
            L.append(f"| {af['name']} | {af['group']} | — | | | | | | **{c}** |")
    L.append(f"\n## Unmatched ({len(unmatched)}) — need USDA, a composite computation, or an alias\n")
    L.append(", ".join(sorted(m["app"]["name"] for m in unmatched)) or "(none)")
    L.append(f"\n## Data-quality flags ({len(flagged)}) — rows failing the Atwater/energy check\n")
    if flagged:
        L.append("| IFCT code | Name | kcal | P | F | C | Fibre | Flag |")
        L.append("|---|---|--:|--:|--:|--:|--:|---|")
        for f in flagged[:40]:
            L.append(f"| {f['code']} | {f['name']} | {f['kcal']} | {f['protein']} | {f['fat']} | "
                     f"{f['carb']} | {f['fibre']} | {', '.join(f['flags'])} |")
    else:
        L.append("(none)")
    open(path, "w", encoding="utf-8").write("\n".join(L))


def main():
    app_foods = load_app_foods()
    header, recs = load_ifct()
    ifct = transform(header, recs)
    matches = match_app_foods(app_foods, ifct)
    emit_sql(ifct, OUT_SQL)
    emit_report(app_foods, ifct, matches, OUT_REPORT)
    matched = sum(1 for m in matches if m["ifct"])
    flagged = sum(1 for f in ifct if f["flags"])
    print(f"app foods parsed : {len(app_foods)}")
    print(f"IFCT foods       : {len(ifct)}")
    print(f"matched          : {matched}/{len(app_foods)}")
    print(f"unmatched        : {len(app_foods)-matched}")
    print(f"data-quality flags: {flagged}")
    print(f"SQL  -> {os.path.relpath(OUT_SQL, ROOT)}")
    print(f"report-> {os.path.relpath(OUT_REPORT, ROOT)}")


if __name__ == "__main__":
    main()
