import { useMemo, useState } from "react";
import { useFoodLog } from "../../hooks/useFoodLog.js";
import { num } from "../../utils/foodLog.js";
import { iso, addDays, todayIso } from "../../utils/dates.js";
import { MealLogger } from "../log/MealLogger.jsx";
import { ShareLogModal } from "../log/ShareLogModal.jsx";
import {
  Trash2, Utensils, History, Plus, CalendarDays, Share2,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
} from "lucide-react";

const r0 = n => Math.round(num(n));
const r1 = n => Math.round(num(n) * 10) / 10;
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snack"];

function friendlyDay(isoStr) {
  const d = new Date(isoStr + "T00:00:00");
  const t = new Date(todayIso() + "T00:00:00");
  const diff = Math.round((d - t) / 86400000);
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function DayNav({ date, setDate }) {
  const isToday = date >= todayIso();
  const shift = n => setDate(iso(addDays(new Date(date + "T00:00:00"), n)));
  return (
    <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-1.5 py-1.5">
      <button onClick={() => shift(-1)} aria-label="Previous day"
        className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 active:scale-95 transition-all">
        <ChevronLeft size={18} />
      </button>
      <label className="flex-1 flex items-center justify-center gap-2 cursor-pointer">
        <CalendarDays size={15} className="text-indigo-500 shrink-0" />
        <span className="text-sm font-bold text-slate-800">{friendlyDay(date)}</span>
        <input type="date" value={date} max={todayIso()}
          onChange={e => e.target.value && setDate(e.target.value)}
          aria-label="Pick a date"
          className="w-[1.1rem] text-transparent bg-transparent border-0 p-0 focus:outline-none cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60" />
      </label>
      {!isToday && (
        <button onClick={() => setDate(todayIso())}
          className="text-xs font-semibold text-indigo-600 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors">
          Today
        </button>
      )}
      <button onClick={() => shift(1)} aria-label="Next day" disabled={isToday}
        className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none">
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

function TotalsBar({ totals, targetKcal }) {
  const pct = targetKcal ? Math.min(100, Math.round((totals.kcal / targetKcal) * 100)) : null;
  const remaining = targetKcal ? Math.round(targetKcal - totals.kcal) : null;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="text-3xl font-bold text-slate-900 tabular-nums">{r0(totals.kcal)}</div>
          <div className="text-xs text-slate-500">
            kcal{targetKcal ? ` of ${targetKcal}` : " logged"}
            {remaining != null && <span className={remaining < 0 ? "text-rose-500 font-semibold" : ""}>{remaining >= 0 ? ` · ${remaining} left` : ` · ${-remaining} over`}</span>}
          </div>
        </div>
        <div className="flex gap-4 text-right">
          {[["Protein", totals.protein_g], ["Carbs", totals.carb_g], ["Fat", totals.fat_g], ["Fibre", totals.fibre_g]].map(([k, v]) => (
            <div key={k}>
              <div className="text-sm font-bold text-slate-700 tabular-nums">{r1(v)}g</div>
              <div className="text-[10px] text-slate-500">{k}</div>
            </div>
          ))}
        </div>
      </div>
      {pct != null && (
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-rose-400" : "bg-indigo-500"}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

function LogItem({ l, onRemove }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-800 truncate">{l.custom_name}</div>
        <div className="text-[11px] text-slate-500 truncate">
          {l.grams ? `${r0(l.grams)}g · ` : ""}P{r1(l.protein_g)} · C{r1(l.carb_g)} · F{r1(l.fat_g)}{l.fibre_g ? ` · Fi${r1(l.fibre_g)}` : ""}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-bold text-slate-700 tabular-nums">{r0(l.kcal)}</div>
        <div className="text-[10px] text-slate-400">kcal</div>
      </div>
      <button onClick={() => onRemove(l.id)} aria-label={`Remove ${l.custom_name}`} className="text-slate-300 hover:text-rose-500 shrink-0 inline-flex items-center justify-center min-h-11 min-w-11 -my-2 -mr-2">
        <Trash2 size={15} />
      </button>
    </div>
  );
}

function Collapsible({ icon: Icon, title, count, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 focus-visible:outline-none">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          {Icon && <Icon size={15} className="text-slate-400" />} {title}
          {count != null && <span className="text-xs font-bold text-slate-500">({count})</span>}
        </span>
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      {open && <div className="px-3 pb-3 pt-1 space-y-1.5 border-t border-slate-100">{children}</div>}
    </div>
  );
}

export function LogTab({ session, nutrition, country = "india" }) {
  const { date, setDate, logs, units, totals, history, dayHistory, search, fetchMeasures, addLog, removeLog } = useFoodLog(session);
  const [shareOpen, setShareOpen] = useState(false);

  // The user's frequent dishes, ready to re-log in one tap (carries the last portion + macros).
  const recent = useMemo(() => (history || []).slice(0, 8), [history]);

  // Today's entries grouped by meal, in meal order, each with a kcal subtotal.
  const mealGroups = useMemo(() => {
    const m = new Map();
    for (const l of logs) {
      const key = l.meal || "other";
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(l);
    }
    return [...m.keys()]
      .sort((a, b) => (MEAL_ORDER.indexOf(a) + 1 || 99) - (MEAL_ORDER.indexOf(b) + 1 || 99))
      .map(meal => ({ meal, items: m.get(meal), subtotal: m.get(meal).reduce((s, x) => s + num(x.kcal), 0) }));
  }, [logs]);

  function reLog(h) {
    return addLog({
      source: h.source, ingredient_id: h.ingredient_id, recipe_id: h.recipe_id,
      custom_name: h.custom_name, meal: h.meal, qty: num(h.qty), unit: h.unit, grams: num(h.grams),
      kcal: num(h.kcal), protein_g: num(h.protein_g), fat_g: num(h.fat_g), carb_g: num(h.carb_g), fibre_g: num(h.fibre_g),
    });
  }

  const targetKcal = num(nutrition?.dailyCalories) || null;

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-fadeUp">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Utensils size={18} className="text-indigo-600" /> Food log
        </h1>
      </div>

      <DayNav date={date} setDate={setDate} />

      <TotalsBar totals={totals} targetKcal={targetKcal} />

      <MealLogger
        session={session} country={country}
        search={search} fetchMeasures={fetchMeasures} units={units} addLog={addLog}
      />

      {/* What you logged — grouped by meal */}
      {logs.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
          <Utensils size={20} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-500">Nothing logged {friendlyDay(date) === "Today" ? "yet" : /^(Yesterday|Tomorrow)$/.test(friendlyDay(date)) ? friendlyDay(date) : `on ${friendlyDay(date)}`}</p>
          <p className="text-xs text-slate-500 mt-1">Type what you ate above to add an item.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{friendlyDay(date)}’s log</span>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold text-slate-500">{logs.length} item{logs.length === 1 ? "" : "s"}</span>
              <button onClick={() => setShareOpen(true)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 active:scale-95 transition-all">
                <Share2 size={13} /> Share
              </button>
            </div>
          </div>
          {mealGroups.map(g => (
            <div key={g.meal} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50/70 border-b border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-600">{cap(g.meal)}</span>
                <span className="text-xs font-bold text-slate-500 tabular-nums">{r0(g.subtotal)} kcal</span>
              </div>
              <div className="divide-y divide-slate-50">
                {g.items.map(l => <LogItem key={l.id} l={l} onRemove={removeLog} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick add — frequent foods, relocated below the day's log */}
      {recent.length > 0 && (
        <Collapsible icon={Plus} title="Quick add" count={recent.length}>
          {recent.map((h, i) => (
            <button key={`${h.custom_name}-${i}`} onClick={() => reLog(h)}
              className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl border border-slate-100 bg-slate-50/60 hover:border-indigo-200 hover:bg-indigo-50/40 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">{h.custom_name}</div>
                <div className="text-[11px] text-slate-500 truncate">
                  {h.grams ? `${r0(h.grams)}g · ` : ""}{r0(h.kcal)} kcal{h.meal ? ` · ${h.meal}` : ""}{h.count > 1 ? ` · ×${h.count}` : ""}
                </div>
              </div>
              <Plus size={15} className="text-indigo-400 shrink-0" />
            </button>
          ))}
        </Collapsible>
      )}

      {/* History — jump to any previous day */}
      {dayHistory.length > 0 && (
        <Collapsible icon={History} title="Past days" count={dayHistory.length}>
          {dayHistory.map(d => (
            <button key={d.date} onClick={() => setDate(d.date)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                d.date === date ? "bg-indigo-50 border border-indigo-200" : "border border-transparent hover:bg-slate-50"
              }`}>
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">{friendlyDay(d.date)}</div>
                <div className="text-[11px] text-slate-500">{d.count} item{d.count === 1 ? "" : "s"}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold text-slate-700 tabular-nums">{r0(d.kcal)}</div>
                <div className="text-[10px] text-slate-500">kcal</div>
              </div>
            </button>
          ))}
        </Collapsible>
      )}

      {shareOpen && (
        <ShareLogModal logs={logs} date={date} totalKcal={totals.kcal} onClose={() => setShareOpen(false)} />
      )}
    </div>
  );
}
