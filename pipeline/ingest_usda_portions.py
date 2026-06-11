#!/usr/bin/env python3
"""Populate the `measures` table (portion -> grams, v3) from USDA FoodData Central
`food_portion.csv`.

USDA portions are mapped to our ingredients via nutrient_values.source_food_code
(= fdc_id, written by ingest_usda.py). Each USDA food got one ingredient row, so a
food_portion row resolves to exactly one ingredient. Macros stay per-100g; measures
are gram-entry shortcuts (see the maturity path in docs/food-logging-roadmap.md).

Download (small): the SR Legacy + Foundation CSV bundles from
https://fdc.nal.usda.gov/download-datasets.html, unzip, point --sr-dir / --fnd-dir
at the folders containing food_portion.csv + measure_unit.csv.

Usage:
  pipeline/.venv/bin/python pipeline/ingest_usda_portions.py --sr-dir /tmp/usda_fp/sr --fnd-dir /tmp/usda_fp/fnd
"""
import argparse
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_URL_FILE = os.path.join(ROOT, "pipeline/.db_url")

SELECT = """
  cast(fp.fdc_id as varchar) as fdc_id,
  trim(
    case when fp.amount is null then '1'
         when fp.amount = floor(fp.amount) then cast(cast(fp.amount as bigint) as varchar)
         else cast(fp.amount as varchar) end
    || ' ' ||
    case when mu.name is null or mu.name = 'undetermined' then '' else mu.name || ' ' end
    || coalesce(nullif(fp.modifier, ''), nullif(fp.portion_description, ''), '')
  ) as label,
  case when mu.name is null or mu.name = 'undetermined' then 'serving' else mu.name end as unit,
  fp.gram_weight as grams,
  fp.seq_num as seq
"""

# Run natively in Postgres (postgres_execute) so the join + delete behave normally.
PG_DELETE = "delete from measures where source_id like 'USDA%'"
PG_INSERT = """
  insert into measures (ingredient_id, label, unit, grams, is_default, source_id)
  select ist.ingredient_id, s.label, s.unit, s.grams, (s.seq = 1), nv.source_id
  from fp_stage s
  join nutrient_values nv on nv.source_food_code = s.fdc_id and nv.source_id like 'USDA%'
  join ingredient_states ist on ist.id = nv.ingredient_state_id
"""


def csvs(d, name):
    p = os.path.join(d, name)
    if not os.path.exists(p):
        sys.exit(f"missing {p}")
    return p


def main():
    ap = argparse.ArgumentParser(description="Load USDA food_portion into measures.")
    ap.add_argument("--sr-dir", required=True, help="dir with SR Legacy food_portion.csv + measure_unit.csv")
    ap.add_argument("--fnd-dir", required=True, help="dir with Foundation food_portion.csv + measure_unit.csv")
    args = ap.parse_args()

    try:
        import duckdb
    except ImportError:
        sys.exit("duckdb missing -> pipeline/.venv/bin/pip install duckdb")
    if not os.path.exists(DB_URL_FILE):
        sys.exit(f"missing {DB_URL_FILE}")
    db_url = open(DB_URL_FILE, encoding="utf-8").read().strip()

    fp_files = [csvs(args.sr_dir, "food_portion.csv"), csvs(args.fnd_dir, "food_portion.csv")]
    mu_files = [csvs(args.sr_dir, "measure_unit.csv"), csvs(args.fnd_dir, "measure_unit.csv")]
    fp_list = "[" + ", ".join(f"'{p}'" for p in fp_files) + "]"
    mu_list = "[" + ", ".join(f"'{p}'" for p in mu_files) + "]"

    con = duckdb.connect()
    con.execute("INSTALL postgres; LOAD postgres;")
    con.execute(f"ATTACH '{db_url}' AS pg (TYPE postgres)")
    con.execute(f"create or replace temp view fp as select * from read_csv_auto({fp_list}, header=true, union_by_name=true)")
    con.execute(f"create or replace temp view mu as select distinct id, name from read_csv_auto({mu_list}, header=true)")

    con.execute("DROP TABLE IF EXISTS pg.fp_stage")
    con.execute("create table pg.fp_stage (fdc_id text, label text, unit text, grams double, seq int)")
    con.execute(f"""
      insert into pg.fp_stage
      select {SELECT.strip()}
      from fp left join mu on mu.id = fp.measure_unit_id
      where fp.gram_weight is not null and fp.gram_weight > 0
    """)
    staged = con.execute("select count(*) from pg.fp_stage").fetchone()[0]
    print(f"staged portions: {staged:,}")

    con.execute("CALL postgres_execute('pg', $$%s$$)" % PG_DELETE)
    con.execute("CALL postgres_execute('pg', $$%s$$)" % PG_INSERT)
    con.execute("DROP TABLE IF EXISTS pg.fp_stage")

    total = con.execute("select count(*) from pg.measures").fetchone()[0]
    ings = con.execute("select count(distinct ingredient_id) from pg.measures").fetchone()[0]
    print(f"measures rows: {total:,}  across {ings:,} ingredients")


if __name__ == "__main__":
    main()
