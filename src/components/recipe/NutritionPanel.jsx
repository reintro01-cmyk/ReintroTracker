import { macroGrams } from "../../utils/mealPlanner.js";

function MacroBar({ macros }) {
  const total = macros.fat + macros.carbs + macros.protein + macros.fibre;
  const warn = Math.abs(total - 100) > 1;
  const segments = [
    { key: "fat",     label: "Fat",     pct: macros.fat,     cls: "bg-amber-400"   },
    { key: "carbs",   label: "Carbs",   pct: macros.carbs,   cls: "bg-blue-400"    },
    { key: "protein", label: "Protein", pct: macros.protein, cls: "bg-orange-400"  },
    { key: "fibre",   label: "Fibre",   pct: macros.fibre,   cls: "bg-emerald-400" },
  ];
  return (
    <div>
      <div className="flex rounded-full overflow-hidden h-3 gap-px">
        {segments.map(s => (
          <div key={s.key} style={{ width: `${s.pct}%` }} className={`${s.cls} transition-all duration-300`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-3 mt-2">
        {segments.map(s => (
          <span key={s.key} className="flex items-center gap-1 text-xs text-slate-500">
            <span className={`w-2 h-2 rounded-full ${s.cls}`} />
            {s.label} {s.pct}%
          </span>
        ))}
        {warn && <span className="text-xs text-rose-500 font-semibold">⚠ Total ≠ 100% ({total}%)</span>}
      </div>
    </div>
  );
}

export function DailyTotals({ dailyCalories, macros }) {
  const grams = macroGrams(dailyCalories, macros);
  const items = [
    { label: "Total",   value: `${dailyCalories} kcal`, cls: "text-indigo-700 bg-indigo-50 border-indigo-200"   },
    { label: "Protein", value: `${grams.protein}g`,     cls: "text-orange-700 bg-orange-50 border-orange-200"  },
    { label: "Fat",     value: `${grams.fat}g`,         cls: "text-amber-700 bg-amber-50 border-amber-200"     },
    { label: "Carbs",   value: `${grams.carbs}g`,       cls: "text-blue-700 bg-blue-50 border-blue-200"        },
    { label: "Fibre",   value: `${grams.fibre}g`,       cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(item => (
        <div key={item.label} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${item.cls}`}>
          <span className="text-xs font-normal opacity-60 mr-1">{item.label}</span>
          {item.value}
        </div>
      ))}
    </div>
  );
}

export function NutritionPanel({ nutrition, onChange }) {
  const { dailyCalories, macros } = nutrition;
  const grams = macroGrams(dailyCalories, macros);

  const MACROS = [
    { key: "fat",     label: "Fat",     colorCls: "text-amber-600",   accentCls: "accent-amber-500"   },
    { key: "carbs",   label: "Carbs",   colorCls: "text-blue-600",    accentCls: "accent-blue-500"    },
    { key: "protein", label: "Protein", colorCls: "text-orange-600",  accentCls: "accent-orange-500"  },
    { key: "fibre",   label: "Fibre",   colorCls: "text-emerald-600", accentCls: "accent-emerald-500" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">Daily calorie target</div>
        <div className="flex items-center gap-3">
          <label htmlFor="daily-calories" className="sr-only">Daily calorie target</label>
          <input
            id="daily-calories"
            type="number" min={400} max={3000} step={50}
            value={dailyCalories}
            onChange={e => onChange({ ...nutrition, dailyCalories: Math.max(400, Number(e.target.value) || 800) })}
            className="w-24 rounded-xl border-2 border-slate-200 px-3 py-2 text-xl font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
          />
          <span className="text-sm text-slate-500 font-medium">kcal / day</span>
        </div>
      </div>

      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Macro split</div>
          {(() => {
            const total = macros.fat + macros.carbs + macros.protein + macros.fibre;
            const remaining = 100 - total;
            return (
              <span className={`text-[11px] font-bold tabular-nums ${remaining === 0 ? "text-emerald-600" : remaining < 0 ? "text-rose-500" : "text-slate-500"}`}>
                {remaining === 0 ? "✓ 100%" : `${total}% · ${remaining > 0 ? remaining : 0}% remaining`}
              </span>
            );
          })()}
        </div>
        {MACROS.map(({ key, label, colorCls, accentCls }) => {
          const othersSum = Object.entries(macros).filter(([k]) => k !== key).reduce((sum, [, val]) => sum + val, 0);
          const sliderMax = Math.max(macros[key], 100 - othersSum);
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-xs font-bold ${colorCls}`}>{label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-slate-800 tabular-nums">{macros[key]}%</span>
                  <span className="text-xs text-slate-500 tabular-nums w-8 text-right">{grams[key]}g</span>
                </div>
              </div>
              <input
                type="range" min={0} max={sliderMax} value={macros[key]}
                aria-label={`${label} percentage of daily calories`}
                aria-valuetext={`${macros[key]} percent, ${grams[key]} grams`}
                onChange={e => {
                  const v = Math.min(Number(e.target.value) || 0, 100 - othersSum);
                  onChange({ ...nutrition, macros: { ...macros, [key]: v } });
                }}
                className={`w-full ${accentCls}`}
              />
            </div>
          );
        })}
      </div>

      <MacroBar macros={macros} />
    </div>
  );
}

export { MacroBar };
