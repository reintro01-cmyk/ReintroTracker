#!/usr/bin/env python3
"""Load Open Food Facts (branded/packaged foods) straight into the live nutrition DB.

OFF ships ~4M products as a single ~7.5GB Parquet with NESTED columns:
  nutriments  : LIST<STRUCT(name, value, "100g", serving, unit, ...)>
  product_name: LIST<STRUCT(lang, text)>
  *_tags       : LIST<VARCHAR>

DuckDB streams the (optionally remote) Parquet, flattens + quality-gates the rows into
a Postgres staging table via ATTACH, then runs three native Postgres upserts (so
ON CONFLICT works) to land ingredients -> states -> nutrient_values. No psql, no CSV.

Prereqs:
  pipeline/.venv/bin/pip install duckdb          (duckdb with httpfs + postgres extensions)
  pipeline/.db_url  -> a postgresql:// URI (session pooler; password percent-encoded)

Usage (run with the venv python):
  pipeline/.venv/bin/python pipeline/ingest_off.py --limit 100000
  pipeline/.venv/bin/python pipeline/ingest_off.py --parquet /local/food.parquet --countries en:india

Notes:
  * --limit STREAMS (reads row-groups until satisfied) — fast, but grabs the LOWEST
    barcodes first (arbitrary slice). For a useful/India-focused or popularity-ranked
    load, download food.parquet locally and use --countries / --order-by (full scan).
  * Storage: a full load (~1-2M usable rows) exceeds Supabase's free 500MB tier —
    subset, or move to Pro (8GB) first.
"""
import argparse
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_URL_FILE = os.path.join(ROOT, "pipeline/.db_url")
DEFAULT_PARQUET = "https://huggingface.co/datasets/openfoodfacts/product-database/resolve/main/food.parquet"

# Per-100g extraction from the nested nutriments list + English-preferred product name.
SELECT = """
  code as barcode,
  coalesce(list_filter(product_name, x -> x.lang='en')[1].text, product_name[1].text) as name,
  brands as brand,
  array_to_string(categories_tags, '|') as category,
  list_filter(nutriments, x -> x.name='energy-kcal')[1]."100g"   as kcal,
  list_filter(nutriments, x -> x.name='proteins')[1]."100g"      as protein,
  list_filter(nutriments, x -> x.name='fat')[1]."100g"           as fat,
  list_filter(nutriments, x -> x.name='carbohydrates')[1]."100g" as carb,
  list_filter(nutriments, x -> x.name='fiber')[1]."100g"         as fibre,
  list_filter(nutriments, x -> x.name='water')[1]."100g"         as water
"""

# Reject crowd-sourced junk: missing name/barcode, impossible energy, negative or
# >100g macros, macro sums over 100g/100g.
GATE = """
  name is not null and length(trim(name)) > 0
  and barcode is not null and length(trim(barcode)) >= 6
  and kcal between 0 and 900
  and protein between 0 and 100 and fat between 0 and 100 and carb between 0 and 100
  and coalesce(protein,0) + coalesce(fat,0) + coalesce(carb,0) <= 100
"""

UPSERTS = [
    """insert into ingredients (slug, canonical_name, category, brand, barcode)
       select 'off-' || barcode, name, nullif(category,''), nullif(brand,''), barcode
       from off_stage
       on conflict (barcode) where barcode is not null do nothing""",
    """insert into ingredient_states (ingredient_id, state)
       select i.id, 'as-sold' from ingredients i join off_stage s on s.barcode = i.barcode
       on conflict (ingredient_id, state) do nothing""",
    """insert into nutrient_values
         (ingredient_state_id, source_id, source_food_code, basis, energy_kcal,
          protein_g, fat_g, carb_avail_g, fibre_g, water_g, provenance, confidence)
       select ist.id, 'OFF', s.barcode, 'per_100g', s.kcal, s.protein, s.fat, s.carb,
              s.fibre, s.water, 'measured', 'low'
       from off_stage s
       join ingredients i on i.barcode = s.barcode
       join ingredient_states ist on ist.ingredient_id = i.id and ist.state = 'as-sold'
       on conflict (ingredient_state_id, source_id, version) do nothing""",
]


def main():
    ap = argparse.ArgumentParser(description="Load Open Food Facts into the nutrition DB.")
    ap.add_argument("--parquet", default=DEFAULT_PARQUET, help="OFF food.parquet (URL or local path)")
    ap.add_argument("--limit", type=int, default=100000, help="Max products to load (streams)")
    ap.add_argument("--countries", nargs="*", default=None,
                    help="OFF country tags to keep, e.g. en:india. WARNING: forces a full ~7.5GB scan.")
    ap.add_argument("--order-by-popularity", action="store_true",
                    help="Rank by OFF popularity_key desc. WARNING: forces a full scan.")
    args = ap.parse_args()

    try:
        import duckdb
    except ImportError:
        sys.exit("duckdb missing -> pipeline/.venv/bin/pip install duckdb")
    if not os.path.exists(DB_URL_FILE):
        sys.exit(f"missing {DB_URL_FILE} (session-pooler postgresql:// URI)")
    db_url = open(DB_URL_FILE, encoding="utf-8").read().strip()

    where = [GATE]
    if args.countries:
        tags = ", ".join(f"'{c}'" for c in args.countries)
        where.append(f"len(list_intersect(countries_tags, [{tags}])) > 0")
    order_sql = ""
    if args.order_by_popularity:
        order_sql = "order by popularity_key desc nulls last"
    where_sql = " and ".join(f"({w.strip()})" for w in where)

    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs; INSTALL postgres; LOAD postgres;")
    con.execute(f"ATTACH '{db_url}' AS pg (TYPE postgres)")
    con.execute("DROP TABLE IF EXISTS pg.off_stage")
    con.execute("""create table pg.off_stage (
      barcode text, name text, brand text, category text,
      kcal double, protein double, fat double, carb double, fibre double, water double)""")

    print(f"Streaming {args.parquet}\n  filter: {'+countries ' if args.countries else ''}gate; limit {args.limit}")
    con.execute(f"""
      insert into pg.off_stage
      select barcode, name, brand, category, kcal, protein, fat, carb, fibre, water from (
        select {SELECT.strip()} from read_parquet('{args.parquet}')
      ) where {where_sql} {order_sql} limit {int(args.limit)}
    """)
    staged = con.execute("select count(*) from pg.off_stage").fetchone()[0]
    print(f"staged: {staged:,}")

    for sql in UPSERTS:
        con.execute("CALL postgres_execute('pg', $$%s$$)" % sql.replace("$$", ""))

    con.execute("DROP TABLE IF EXISTS pg.off_stage")
    total = con.execute("select count(*) from pg.nutrient_values where source_id='OFF'").fetchone()[0]
    print(f"OFF nutrient_values total now: {total:,}")


if __name__ == "__main__":
    main()
