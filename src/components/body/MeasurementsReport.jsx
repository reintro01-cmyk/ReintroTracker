// Body-measurement trends for the Reports tab. Measurements are stored in cm (MeasurementLogger
// converts inches -> cm on save); we display in the user's chosen unit. Shows, per tracked field,
// the latest value, the change since the first record, and a tiny sparkline. Decrease is coloured
// emerald to match the weight widget's progress convention (this is a weight-loss programme).

const BUILTIN = [
  { key: "waist", label: "Waist" }, { key: "hips", label: "Hips" },
  { key: "chest", label: "Chest" }, { key: "abdomen", label: "Abdomen" },
  { key: "armL", label: "Arm L" }, { key: "armR", label: "Arm R" },
  { key: "thighL", label: "Thigh L" }, { key: "thighR", label: "Thigh R" },
];

const shortDate = iso => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

function Sparkline({ values }) {
  if (values.length < 2) return null;
  const w = 60, h = 22, min = Math.min(...values), max = Math.max(...values), span = (max - min) || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / span) * (h - 2) - 1}`).join(" ");
  return (
    <svg width={w} height={h} className="text-indigo-400 shrink-0" aria-hidden="true">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function MeasurementsReport({ measurements = [], customFields = [], unit = "cm" }) {
  const conv = v => (unit === "in" ? v / 2.54 : v);
  const fmt = v => Math.round(conv(v) * 10) / 10;

  const fields = [...BUILTIN, ...customFields.map(f => ({ key: f.id, label: f.label }))];
  const rows = fields
    .map(f => ({
      ...f,
      series: measurements
        .filter(m => m[f.key] != null && !Number.isNaN(Number(m[f.key])))
        .map(m => ({ date: m.date, value: Number(m[f.key]) })),
    }))
    .filter(r => r.series.length > 0);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No measurements logged yet. Add them in <span className="font-semibold text-slate-600">Profile → Measurements</span>.
      </p>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {rows.map(r => {
        const latest = r.series[r.series.length - 1].value;
        const first = r.series[0].value;
        const delta = latest - first;
        const down = delta < -0.05, up = delta > 0.05;
        return (
          <div key={r.key} className="rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-500 truncate">{r.label}</div>
              <div className="text-lg font-bold text-slate-900 tabular-nums">
                {fmt(latest)}<span className="text-xs font-medium text-slate-400 ml-0.5">{unit}</span>
              </div>
              {r.series.length > 1 ? (
                <div className={`text-[11px] font-semibold ${down ? "text-emerald-600" : up ? "text-slate-500" : "text-slate-400"}`}>
                  {down ? "▼" : up ? "▲" : "±"} {fmt(Math.abs(delta))} {unit} <span className="font-normal text-slate-400">since {shortDate(r.series[0].date)}</span>
                </div>
              ) : (
                <div className="text-[11px] text-slate-400">1 reading · {shortDate(r.series[0].date)}</div>
              )}
            </div>
            <Sparkline values={r.series.map(s => s.value)} />
          </div>
        );
      })}
    </div>
  );
}
