-- Open Food Facts (branded / packaged-food) support.
--
-- OFF products are branded items identified by a barcode (EAN/UPC). We extend the
-- ingredient model with barcode + brand and register OFF as a source. Per-100g
-- nutrition lands in nutrient_values like any other source. OFF data is crowd-sourced,
-- so it's stored at 'low' confidence and sits below IFCT/USDA in ingredient_resolved —
-- which is correct: generic whole foods prefer IFCT/USDA, and branded items (barcode)
-- exist only in OFF so they win by being the sole source.

alter table ingredients add column if not exists barcode text;
alter table ingredients add column if not exists brand   text;

-- One ingredient per barcode; trigram index on brand for fuzzy brand search.
create unique index if not exists ingredients_barcode_uniq on ingredients (barcode) where barcode is not null;
create index if not exists ingredients_brand_trgm on ingredients using gin (brand gin_trgm_ops);

insert into sources (id, name, description, license, url, retrieved_at) values
  ('OFF', 'Open Food Facts',
   'Crowd-sourced global packaged-food database (~4M products, barcodes, multilingual).',
   'ODbL v1.0 — free for any use incl. commercial; requires attribution and share-alike on derived datasets.',
   'https://world.openfoodfacts.org', '2026-05-31')
on conflict (id) do nothing;
