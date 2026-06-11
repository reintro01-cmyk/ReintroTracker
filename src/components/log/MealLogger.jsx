import { useState } from "react";
import { useMealLogger } from "../../hooks/useMealLogger.js";
import { LogLineRow } from "./LogLineRow.jsx";
import { num } from "../../utils/foodLog.js";
import { Button } from "../ui.jsx";
import { Sparkles, Loader2, Check, Utensils, AlertTriangle } from "lucide-react";

const MEALS = ["breakfast", "lunch", "dinner", "snack"];
const r0 = n => Math.round(num(n));
const r1 = n => Math.round(num(n) * 10) / 10;

const PLACEHOLDER = `What did you eat? Type it like you'd say it.

e.g.
2 rotis
a bowl of dal
1 cup rice`;

// Free-text meal logging: type a meal in natural language, we parse it into items and work out
// the calories from the food DB; anything unmatched falls back to manual entry. Logs every
// accounted item to the day via the injected addLog (which owns the selected date).
export function MealLogger({ session, country = "india", search, fetchMeasures, units, addLog, onLogged }) {
  const ml = useMealLogger({ session, country, search, fetchMeasures, units, addLog });
  const [meal, setMeal] = useState("breakfast");
  const [savedMsg, setSavedMsg] = useState("");
  const reviewing = ml.lines.length > 0;

  async function handleLog() {
    const res = await ml.logAll(meal);
    if (res.error) return;
    ml.reset();
    setSavedMsg(`Logged ${res.logged} item${res.logged === 1 ? "" : "s"}${res.skipped ? ` · ${res.skipped} skipped (no value)` : ""}`);
    onLogged?.();
    setTimeout(() => setSavedMsg(""), 2600);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <Utensils size={15} className="text-indigo-600" /> Log a meal
        </div>
        <label className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Meal</span>
          <select value={meal} onChange={e => setMeal(e.target.value)}
            className="rounded-lg border-2 border-slate-200 px-2 py-1 text-xs bg-white capitalize focus:outline-none focus:border-indigo-400">
            {MEALS.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
      </div>

      {!reviewing ? (
        <>
          <textarea
            value={ml.text} onChange={e => ml.setText(e.target.value)}
            placeholder={PLACEHOLDER} rows={5} aria-label="What did you eat"
            className="w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 resize-none"
          />
          <p className="text-[11px] text-slate-500">
            We work out the calories for you. Anything we can’t find, you can enter by hand — one item per line is easiest.
          </p>
          {ml.error && <p className="text-xs text-rose-600">{ml.error}</p>}
          {savedMsg && (
            <p role="status" className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
              <Check size={13} /> {savedMsg}
            </p>
          )}
          <div className="flex justify-end">
            <Button onClick={ml.parse} disabled={!ml.text.trim() || ml.parsing}>
              {ml.parsing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {ml.parsing ? "Reading…" : "Work out calories"}
            </Button>
          </div>
        </>
      ) : (
        <>
          {ml.parseSource === "local" && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
              <AlertTriangle size={13} /> Read offline (smart parser unavailable) — double-check each line.
            </div>
          )}
          <div className="space-y-2">
            {ml.lines.map(line => (
              <LogLineRow
                key={line.id} line={line}
                onMatch={ml.setMatch} onGrams={ml.setGrams} onResearch={ml.researchLine}
                onToggleManual={ml.setManual} onManualMacros={ml.setManualMacros} onRemove={ml.removeLine}
              />
            ))}
          </div>
          {ml.error && <p className="text-xs text-rose-600">{ml.error}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <div className="text-sm">
              <span className="font-bold text-slate-900 tabular-nums">{r0(ml.totals.kcal)}</span>
              <span className="text-slate-500"> kcal</span>
              <span className="text-[11px] text-slate-500"> · P{r1(ml.totals.protein_g)} C{r1(ml.totals.carb_g)} F{r1(ml.totals.fat_g)}</span>
              <span className="text-[11px] text-slate-500 block">
                {ml.totals.counts.accounted} ready{ml.totals.counts.unaccounted ? ` · ${ml.totals.counts.unaccounted} need a value` : ""}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={ml.reset}>Clear</Button>
              <Button size="sm" onClick={handleLog} disabled={ml.logging || ml.totals.counts.accounted === 0}>
                {ml.logging ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Log {ml.totals.counts.accounted} item{ml.totals.counts.accounted === 1 ? "" : "s"}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
