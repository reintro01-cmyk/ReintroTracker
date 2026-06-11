import { useState, useEffect, useRef } from "react";
import { useRecipeBuilder } from "../../hooks/useRecipeBuilder.js";
import { num } from "../../utils/foodLog.js";
import { Button } from "../ui.jsx";
import { X, Loader2, Trash2, Sparkles, ChefHat, AlertTriangle, Check, Search } from "lucide-react";

const MEALS = ["breakfast", "lunch", "dinner", "snack"];
const r0 = n => Math.round(num(n));
const r1 = n => Math.round(num(n) * 10) / 10;

const FLAG_LABEL = {
  unmatched_ingredients: "Some lines have no match — excluded from totals",
  missing_grams: "Some matched lines need a gram amount",
  atwater_fail: "Calories don't reconcile with macros — double-check",
};

const PLACEHOLDER = `Paste a recipe, e.g.

2 cups basmati rice
1 tbsp ghee
200 g paneer
1 onion
1 tsp salt

Serves 4`;

function sourceTag(source) {
  if (source === "IFCT-2017") return ["IFCT", "bg-emerald-100 text-emerald-700"];
  if (source === "OFF") return ["Branded", "bg-sky-100 text-sky-700"];
  if (source?.startsWith("USDA")) return ["USDA", "bg-amber-100 text-amber-700"];
  return [source || "?", "bg-slate-100 text-slate-500"];
}

function LineRow({ line, onMatch, onGrams, onResearch, onRemove }) {
  const food = line.matchIndex >= 0 ? line.candidates[line.matchIndex] : null;
  const [tag, tagCls] = sourceTag(food?.source_id);
  const grams = num(line.grams);
  const kcal = food && grams > 0 ? num(food.kcal) * grams / 100 : 0;
  const needsGrams = food && !(grams > 0);

  return (
    <div className={`rounded-xl border p-3 space-y-2 ${food ? "border-slate-200 bg-white" : "border-amber-200 bg-amber-50/50"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] text-slate-500 truncate flex-1">{line.raw_text}</div>
        <button onClick={() => onRemove(line.id)} aria-label={`Remove "${line.ingredient_guess}"`} className="p-1.5 -m-1 rounded-lg text-slate-500 hover:text-rose-500 hover:bg-rose-50 shrink-0">
          <Trash2 size={14} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* editable search term -> re-runs match on enter/blur */}
        <div className="relative flex-1 min-w-[150px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            key={line.ingredient_guess}
            defaultValue={line.ingredient_guess}
            aria-label={`Search term for "${line.raw_text || line.ingredient_guess}"`}
            onBlur={e => { const v = e.target.value.trim(); if (v && v !== line.ingredient_guess) onResearch(line.id, v); }}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
            className="w-full rounded-lg border border-slate-200 pl-8 pr-2 py-1.5 text-xs focus:outline-none focus:border-indigo-400"
          />
        </div>

        {/* qty · unit (read-only chip from the parse) */}
        {(line.qty != null || line.unit) && (
          <span className="text-[11px] text-slate-500 px-2 py-1 rounded bg-slate-100 whitespace-nowrap">
            {line.qty != null ? r1(line.qty) : ""}{line.unit ? ` ${line.unit}` : ""}
          </span>
        )}

        {/* grams */}
        <div className="flex items-center gap-1">
          <input
            type="number" min="0" step="any"
            value={grams > 0 ? r0(grams) : ""}
            placeholder="set g"
            aria-label={`Grams for "${line.ingredient_guess}"`}
            onChange={e => onGrams(line.id, e.target.value)}
            className={`w-20 rounded-lg border px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-400 ${needsGrams ? "border-amber-400 bg-amber-50" : "border-slate-200"}`}
          />
          <span className="text-[11px] text-slate-500">g</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        {food ? (
          <select
            value={line.matchIndex}
            aria-label={`Matched food for "${line.ingredient_guess}"`}
            onChange={e => onMatch(line.id, Number(e.target.value))}
            className="flex-1 min-w-0 rounded-lg border border-slate-200 px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-indigo-400"
          >
            {line.candidates.map((c, i) => (
              <option key={c.ingredient_id} value={i}>{c.name}{c.brand ? ` · ${c.brand}` : ""}</option>
            ))}
          </select>
        ) : (
          <span className="flex-1 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
            <AlertTriangle size={12} /> No match — edit the term above
          </span>
        )}
        <div className="flex items-center gap-2 shrink-0">
          {food && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${tagCls}`}>{tag}</span>}
          <span className="text-xs font-bold text-indigo-700 tabular-nums w-14 text-right">{r0(kcal)} kcal</span>
        </div>
      </div>
    </div>
  );
}

export function AddRecipeModal({ session, country = "india", search, fetchMeasures, units, onLog, onSaved, onClose }) {
  const rb = useRecipeBuilder({ session, country, search, fetchMeasures, units });
  const [meal, setMeal] = useState("lunch");
  const [savedMsg, setSavedMsg] = useState("");
  const reviewing = rb.lines.length > 0;
  const dialogRef = useRef(null);

  // Dialog a11y: move focus in on open, restore to opener on close, trap Tab, close on Escape.
  useEffect(() => {
    const el = dialogRef.current;
    const opener = document.activeElement;
    if (!el) return;
    const getFocusable = () => el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    (el.querySelector("textarea") || getFocusable()[0])?.focus();
    function handler(e) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;
      const f = getFocusable();
      if (!f.length) { e.preventDefault(); return; }
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", handler);
    return () => { document.removeEventListener("keydown", handler); opener?.focus?.(); };
  }, [onClose]);

  async function handleSaveAndLog() {
    const res = await rb.save();
    if (res.error) return;
    await onLog({
      source: "recipe", recipe_id: res.recipeId, custom_name: res.name, meal,
      qty: 1, unit: "serving", grams: res.perServingGrams,
      kcal: res.perServing.kcal, protein_g: res.perServing.protein_g,
      fat_g: res.perServing.fat_g, carb_g: res.perServing.carb_g, fibre_g: res.perServing.fibre_g,
    });
    onSaved?.();
    onClose();
  }

  async function handleSaveOnly() {
    const res = await rb.save();
    if (res.error) return;
    onSaved?.();
    setSavedMsg(`Saved “${res.name}” · ${r0(res.perServing.kcal)} kcal/serving`);
    setTimeout(onClose, 1100);
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-recipe-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4"
      onMouseDown={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[92dvh] flex flex-col"
        onMouseDown={e => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h2 id="add-recipe-title" className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ChefHat size={18} className="text-indigo-600" /> Add recipe from text
          </h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 -m-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!reviewing ? (
            <>
              <p className="text-xs text-slate-500">
                Paste any recipe — including an <span className="font-semibold text-slate-600">Instagram caption</span>
                {" "}(hashtags and emojis are fine). We split it into ingredients and compute nutrition from our
                food database — the AI only reads the text, it never invents the numbers.
              </p>
              <textarea
                value={rb.text} onChange={e => rb.setText(e.target.value)}
                placeholder={PLACEHOLDER} rows={10} aria-label="Recipe text"
                className="w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 resize-none font-mono"
              />
              {rb.error && <p className="text-xs text-rose-600">{rb.error}</p>}
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 flex-1 min-w-[160px]">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Recipe name</span>
                  <input value={rb.name} onChange={e => rb.setName(e.target.value)}
                    className="rounded-lg border-2 border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Servings</span>
                  <input type="number" min="1" step="1" value={rb.servings}
                    onChange={e => rb.setServings(Math.max(1, Math.round(num(e.target.value))))}
                    className="w-20 rounded-lg border-2 border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
                </label>
              </div>

              {rb.parseSource === "local" && (
                <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                  <AlertTriangle size={13} /> Parsed offline (AI parser unavailable) — review each line carefully.
                </div>
              )}

              <div className="space-y-2">
                {rb.lines.map(line => (
                  <LineRow key={line.id} line={line}
                    onMatch={rb.setMatch} onGrams={rb.setLineGrams} onResearch={rb.researchLine} onRemove={rb.removeLine} />
                ))}
              </div>

              {rb.totals.flags.map(f => (
                <div key={f} className="flex items-center gap-1.5 text-[11px] text-amber-700">
                  <AlertTriangle size={12} /> {FLAG_LABEL[f] || f}
                </div>
              ))}
            </>
          )}
        </div>

        {/* footer */}
        <div className="border-t border-slate-100 px-5 py-4 shrink-0">
          {!reviewing ? (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={rb.parse} disabled={!rb.text.trim() || rb.parsing}>
                {rb.parsing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                {rb.parsing ? "Parsing…" : "Parse recipe"}
              </Button>
            </div>
          ) : savedMsg ? (
            <div role="status" className="flex items-center justify-center gap-2 text-sm font-semibold text-emerald-700 py-1">
              <Check size={16} /> {savedMsg}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <span className="font-bold text-slate-900 tabular-nums">{r0(rb.totals.perServing.kcal)}</span>
                <span className="text-slate-500"> kcal/serving</span>
                <span className="text-[11px] text-slate-500"> · P{r1(rb.totals.perServing.protein_g)} C{r1(rb.totals.perServing.carb_g)} F{r1(rb.totals.perServing.fat_g)}</span>
                <span className="text-[11px] text-slate-500 block">{rb.totals.counts.matched}/{rb.totals.counts.lines} matched · {r0(rb.totals.total.kcal)} kcal total</span>
              </div>
              <div className="flex items-center gap-2">
                <select value={meal} aria-label="Meal" onChange={e => setMeal(e.target.value)}
                  className="rounded-lg border-2 border-slate-200 px-2 py-1.5 text-xs bg-white capitalize focus:outline-none focus:border-indigo-400">
                  {MEALS.map(x => <option key={x} value={x}>{x}</option>)}
                </select>
                <Button variant={onLog ? "outline" : "default"} size="sm" onClick={handleSaveOnly} disabled={rb.saving}>
                  {rb.saving && !onLog ? <Loader2 size={14} className="animate-spin" /> : null} Save
                </Button>
                {onLog && (
                  <Button size="sm" onClick={handleSaveAndLog} disabled={rb.saving}>
                    {rb.saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save & log
                  </Button>
                )}
              </div>
            </div>
          )}
          {rb.error && reviewing && <p className="text-xs text-rose-600 mt-2 text-right">{rb.error}</p>}
        </div>
      </div>
    </div>
  );
}
