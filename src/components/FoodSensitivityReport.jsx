import { useMemo } from "react";

function FoodReactionRow({ food, accentCls }) {
  return (
    <div className="px-5 py-3.5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`w-2 h-2 rounded-full ${accentCls} shrink-0`} />
          <div className="min-w-0">
            <span className="font-semibold text-sm text-slate-800">{food.name}</span>
            <span className="text-xs text-slate-500 ml-2">{food.group}</span>
          </div>
        </div>
        {food.severity > 0 && (
          <span className="text-xs font-bold text-slate-500 shrink-0 tabular-nums">{food.severity}/5</span>
        )}
      </div>
      {food.symptoms.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 ml-5">
          {food.symptoms.map(s => (
            <span key={s} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 border border-rose-100 text-rose-600">{s}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export function FoodSensitivityReport({ foods, status, observations }) {
  const { safe, limit, avoid, pending } = useMemo(() => {
    const g = { safe: [], limit: [], avoid: [], pending: [] };
    foods.forEach(food => {
      const v = status[food.id];
      const obs = observations[food.id];
      const entry = { ...food, symptoms: obs?.symptoms || [], severity: Number(obs?.severity) || 0 };
      if (v === "Safe")       g.safe.push(entry);
      else if (v === "Limit") g.limit.push(entry);
      else if (v === "Avoid") g.avoid.push(entry);
      else                    g.pending.push(entry);
    });
    return g;
  }, [foods, status, observations]);

  const symptomCounts = useMemo(() => {
    const counts = {};
    Object.values(observations).forEach(obs => {
      (obs?.symptoms || []).forEach(s => { counts[s] = (counts[s] || 0) + 1; });
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const max = sorted[0]?.[1] || 1;
    return sorted.map(([name, count]) => ({ name, count, pct: (count / max) * 100 }));
  }, [observations]);

  const tested = safe.length + limit.length + avoid.length;
  const total  = foods.length;

  if (tested === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        No observations logged yet. Complete some observe days to see your sensitivity report.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Safe",         count: safe.length,    bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500" },
          { label: "With caution", count: limit.length,   bg: "bg-amber-50 border-amber-200",     text: "text-amber-700",   dot: "bg-amber-400"   },
          { label: "Avoid",        count: avoid.length,   bg: "bg-rose-50 border-rose-200",       text: "text-rose-700",    dot: "bg-rose-500"    },
          { label: "Pending",      count: pending.length, bg: "bg-slate-50 border-slate-200",     text: "text-slate-500",   dot: "bg-slate-300"   },
        ].map(({ label, count, bg, text, dot }) => (
          <div key={label} className={`rounded-2xl border p-4 ${bg}`}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className={`w-2 h-2 rounded-full ${dot}`} />
              <span className={`text-[10px] font-bold uppercase tracking-wide ${text} opacity-70`}>{label}</span>
            </div>
            <div className={`text-3xl font-bold ${text}`}>{count}</div>
            <div className={`text-xs mt-0.5 ${text} opacity-50`}>of {total} foods</div>
          </div>
        ))}
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-5 space-y-5 lg:space-y-0">
        <div className="space-y-4">
          {limit.length > 0 && (
            <div className="rounded-2xl border border-amber-200 overflow-hidden bg-white">
              <div className="bg-amber-50 border-b border-amber-100 px-5 py-4">
                <div className="text-[11px] font-bold uppercase tracking-widest text-amber-500 mb-0.5">△ With caution</div>
                <h3 className="font-bold text-sm text-amber-900">Eat sparingly and monitor closely</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {limit.map(f => <FoodReactionRow key={f.id} food={f} accentCls="bg-amber-400" />)}
              </div>
            </div>
          )}

          {avoid.length > 0 && (
            <div className="rounded-2xl border border-rose-200 overflow-hidden bg-white">
              <div className="bg-rose-50 border-b border-rose-100 px-5 py-4">
                <div className="text-[11px] font-bold uppercase tracking-widest text-rose-500 mb-0.5">✕ Avoid</div>
                <h3 className="font-bold text-sm text-rose-900">Triggered significant reactions</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {avoid.map(f => <FoodReactionRow key={f.id} food={f} accentCls="bg-rose-500" />)}
              </div>
            </div>
          )}

          {safe.length > 0 && (
            <div className="rounded-2xl border border-emerald-200 overflow-hidden bg-white">
              <div className="bg-emerald-50 border-b border-emerald-100 px-5 py-4">
                <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-500 mb-0.5">✓ Safe</div>
                <h3 className="font-bold text-sm text-emerald-900">Confirmed safe — {safe.length} food{safe.length !== 1 ? "s" : ""}</h3>
              </div>
              <div className="p-5 flex flex-wrap gap-2">
                {safe.map(f => (
                  <span key={f.id} className="text-sm px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium">{f.name}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {symptomCounts.length > 0 && (
          <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white h-fit">
            <div className="bg-slate-50 border-b border-slate-100 px-5 py-4">
              <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">Patterns</div>
              <h3 className="font-bold text-sm text-slate-800">Top symptoms</h3>
            </div>
            <div className="p-5 space-y-3">
              {symptomCounts.map(({ name, count, pct }) => (
                <div key={name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-700">{name}</span>
                    <span className="text-xs font-bold text-slate-500 tabular-nums">{count}×</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-rose-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
