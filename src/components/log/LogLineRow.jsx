import { lineMacros, lineName } from "../../hooks/useMealLogger.js";
import { num } from "../../utils/foodLog.js";
import { Trash2, AlertTriangle, Search, Pencil } from "lucide-react";

const r0 = n => Math.round(num(n));

function sourceTag(source) {
  if (source === "IFCT-2017") return ["IFCT", "bg-emerald-100 text-emerald-700"];
  if (source === "OFF") return ["Branded", "bg-sky-100 text-sky-700"];
  if (source?.startsWith("USDA")) return ["USDA", "bg-amber-100 text-amber-700"];
  return [source || "?", "bg-slate-100 text-slate-500"];
}

function ManualField({ label, value, onChange, accent }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className={`text-[9px] font-bold uppercase tracking-wide ${accent ? "text-amber-700" : "text-slate-500"}`}>{label}</span>
      <input
        type="number" min="0" step="any" value={value}
        onChange={e => onChange(e.target.value)}
        aria-label={label}
        className={`w-16 rounded-lg border px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-400 ${accent ? "border-amber-400 bg-amber-50 font-semibold" : "border-slate-200"}`}
      />
    </label>
  );
}

// One reviewable item from the parsed meal. Matched lines show a food-match dropdown + grams;
// lines we can't account for fall back to manual calorie/macro entry so they still count.
// Editing the search term re-runs the match (and can flip a manual line back to a matched one).
export function LogLineRow({ line, onMatch, onGrams, onResearch, onToggleManual, onManualMacros, onRemove }) {
  const m = lineMacros(line);
  const food = !line.manual && line.matchIndex >= 0 ? line.candidates[line.matchIndex] : null;
  const [tag, tagCls] = sourceTag(food?.source_id);
  const grams = num(line.grams);
  const needsGrams = food && !(grams > 0);
  const mm = line.manualMacros || {};

  const borderCls = line.manual
    ? (m.accounted ? "border-slate-200 bg-white" : "border-amber-300 bg-amber-50/60")
    : (food ? "border-slate-200 bg-white" : "border-amber-200 bg-amber-50/50");

  return (
    <div className={`rounded-xl border p-3 space-y-2 ${borderCls}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] text-slate-500 truncate flex-1">{line.raw_text || lineName(line)}</div>
        <button onClick={() => onRemove(line.id)} aria-label={`Remove "${lineName(line)}"`}
          className="p-1.5 -m-1 rounded-lg text-slate-500 hover:text-rose-500 hover:bg-rose-50 shrink-0">
          <Trash2 size={14} />
        </button>
      </div>

      {/* editable search term — re-runs the match; for a manual line this is how you go find it */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[150px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            key={line.ingredient_guess}
            defaultValue={line.ingredient_guess}
            aria-label={`Food name for "${line.raw_text || line.ingredient_guess}"`}
            onBlur={e => { const v = e.target.value.trim(); if (v && v !== line.ingredient_guess) onResearch(line.id, v); }}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
            className="w-full rounded-lg border border-slate-200 pl-8 pr-2 py-1.5 text-xs focus:outline-none focus:border-indigo-400"
          />
        </div>

        {(line.qty != null || line.unit) && (
          <span className="text-[11px] text-slate-500 px-2 py-1 rounded bg-slate-100 whitespace-nowrap">
            {line.qty != null ? num(line.qty) : ""}{line.unit ? ` ${line.unit}` : ""}
          </span>
        )}

        {!line.manual && (
          <div className="flex items-center gap-1">
            <input
              type="number" min="0" step="any"
              value={grams > 0 ? r0(grams) : ""}
              placeholder="set g"
              aria-label={`Grams for "${lineName(line)}"`}
              onChange={e => onGrams(line.id, e.target.value)}
              className={`w-20 rounded-lg border px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-400 ${needsGrams ? "border-amber-400 bg-amber-50" : "border-slate-200"}`}
            />
            <span className="text-[11px] text-slate-500">g</span>
          </div>
        )}
      </div>

      {line.manual ? (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700">
            <AlertTriangle size={12} /> Not in our database — enter its calories so it still counts.
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <ManualField label="kcal" value={mm.kcal} accent onChange={v => onManualMacros(line.id, { kcal: v })} />
            <ManualField label="P g" value={mm.protein_g} onChange={v => onManualMacros(line.id, { protein_g: v })} />
            <ManualField label="F g" value={mm.fat_g} onChange={v => onManualMacros(line.id, { fat_g: v })} />
            <ManualField label="C g" value={mm.carb_g} onChange={v => onManualMacros(line.id, { carb_g: v })} />
            <ManualField label="Fib g" value={mm.fibre_g} onChange={v => onManualMacros(line.id, { fibre_g: v })} />
          </div>
          {line.matchIndex >= 0 && line.candidates[line.matchIndex] && (
            <button onClick={() => onToggleManual(line.id, false)}
              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800">
              Use “{line.candidates[line.matchIndex].name}” from database instead
            </button>
          )}
        </div>
      ) : (
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
              <AlertTriangle size={12} /> No match —
              <button onClick={() => onToggleManual(line.id, true)} className="underline">enter it manually</button>
            </span>
          )}
          <div className="flex items-center gap-2 shrink-0">
            {food && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${tagCls}`}>{tag}</span>}
            {food && (
              <button onClick={() => onToggleManual(line.id, true)} title="Enter the value manually instead"
                className="text-[11px] text-slate-500 hover:text-slate-700 inline-flex items-center gap-0.5">
                <Pencil size={11} /> manual
              </button>
            )}
            <span className="text-xs font-bold text-indigo-700 tabular-nums w-14 text-right">{r0(m.kcal)} kcal</span>
          </div>
        </div>
      )}
    </div>
  );
}
