export function StepSummary({ startDate, reintroDate, introOrder, priorityFoods }) {
  return (
    <div className="space-y-4 animate-fadeUp">
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-1">You're all set!</h2>
        <p className="text-sm text-slate-500">Here's your programme summary. You can update any of this in Settings.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 divide-y divide-slate-100">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-slate-500">Detox start</span>
          <span className="text-sm font-semibold text-slate-800">
            {new Date(startDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-slate-500">Reintroduction</span>
          <span className="text-sm font-semibold text-slate-800">{reintroDate}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-slate-500">Food order</span>
          <span className="text-sm font-semibold text-slate-800 capitalize">
            {introOrder === "standard" ? "Standard order" : introOrder === "group" ? "Group by group" : `Priority first (${priorityFoods.length} foods)`}
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <b>800 kcal detox phase</b> with strict foods. Recipe suggestions activate once the programme starts.
      </div>
    </div>
  );
}
