import { Scale, TrendingDown, TrendingUp, BarChart2, Ruler } from "lucide-react";

export function BodySummary({ body }) {
  const weights = body?.weights || [];
  const measurements = body?.measurements || [];

  const latestWeight = weights.at(-1);
  const startWeight = weights[0];

  const weightChange =
    latestWeight && startWeight
      ? latestWeight.kg - startWeight.kg
      : null;
  const isPositiveLoss = weightChange != null && weightChange < 0;
  const isGain         = weightChange != null && weightChange > 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Metric
        icon={Scale}
        value={latestWeight ? `${latestWeight.kg.toFixed(1)}` : "—"}
        unit={latestWeight ? "kg" : ""}
        label="Current weight"
        sub={latestWeight ? latestWeight.date : "No entry"}
        tintCls="bg-[#eff6ff] border-blue-100"
        iconCls="text-blue-500"
        valueCls="text-blue-900"
      />

      <Metric
        icon={isGain ? TrendingUp : TrendingDown}
        value={
          weightChange === null
            ? "—"
            : `${weightChange > 0 ? "+" : ""}${weightChange.toFixed(1)}`
        }
        unit={weightChange === null ? "" : "kg"}
        label="Total change"
        sub={startWeight ? `from ${startWeight.kg.toFixed(1)} kg` : "No start"}
        tintCls="bg-[#f0fdf4] border-emerald-100"
        iconCls={isGain ? "text-rose-500" : "text-emerald-600"}
        valueCls={isGain ? "text-rose-700" : "text-emerald-700"}
      />

      <Metric
        icon={BarChart2}
        value={weights.length}
        unit=""
        label="Weight logs"
        sub="entries"
        tintCls="bg-[#faf5ff] border-purple-100"
        iconCls="text-purple-500"
        valueCls="text-purple-900"
      />

      <Metric
        icon={Ruler}
        value={measurements.length}
        unit=""
        label="Measurement logs"
        sub="entries"
        tintCls="bg-[#fff7ed] border-orange-100"
        iconCls="text-orange-500"
        valueCls="text-orange-900"
      />
    </div>
  );
}

function Metric({ icon: Icon, value, unit, label, sub, tintCls, iconCls, valueCls }) {
  return (
    <div className={`relative rounded-2xl border p-4 ${tintCls}`}>
      <div className="flex items-start justify-between mb-3">
        <Icon size={20} className={iconCls} strokeWidth={2} />
      </div>
      <div className={`text-3xl font-extrabold leading-none tabular-nums ${valueCls}`}>
        {value}
        {unit && <span className="text-base font-bold ml-1 opacity-70">{unit}</span>}
      </div>
      <div className="text-xs font-semibold text-slate-600 mt-2">{label}</div>
      <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>
    </div>
  );
}
