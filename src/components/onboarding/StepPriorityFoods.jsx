export const PRIORITY_MAX = 10;

export function StepPriorityFoods({ priorityFoods, togglePriorityFood, search, setSearch, filteredFoods }) {
  const atLimit = priorityFoods.length >= PRIORITY_MAX;
  return (
    <div className="space-y-4 animate-fadeUp">
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-1">Pick your first 10 foods</h2>
        <p className="text-sm text-slate-500">
          These will be the first to reintroduce. Choose up to {PRIORITY_MAX}; you can pick the rest later inside the app.
        </p>
      </div>

      <input
        type="text" placeholder="Search foods…" value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
      />

      <div className="max-h-56 overflow-y-auto pr-1 space-y-1">
        {filteredFoods.map(food => {
          const selected = priorityFoods.includes(food.id);
          const disabled = !selected && atLimit;
          return (
            <label
              key={food.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                disabled ? "border-slate-100 bg-slate-50/40 cursor-not-allowed opacity-50" : "cursor-pointer"
              } ${
                selected ? "border-indigo-200 bg-indigo-50" : !disabled ? "border-slate-100 bg-white hover:border-slate-200" : ""
              }`}
              title={disabled ? `Limit reached — uncheck one to swap` : undefined}
            >
              <input
                type="checkbox" className="accent-indigo-600 w-4 h-4 shrink-0 disabled:cursor-not-allowed"
                checked={selected}
                disabled={disabled}
                onChange={() => togglePriorityFood(food.id)}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800">{food.name}</div>
                <div className="text-xs text-slate-500">{food.group}</div>
              </div>
            </label>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <div className={`text-xs font-semibold ${atLimit ? "text-amber-700" : priorityFoods.length > 0 ? "text-indigo-600" : "text-slate-500"}`}>
          {priorityFoods.length} of {PRIORITY_MAX} selected{atLimit ? " — limit reached" : ""}
        </div>
        <div className="h-1.5 w-24 rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${atLimit ? "bg-amber-400" : "bg-indigo-500"}`}
            style={{ width: `${Math.min(100, (priorityFoods.length / PRIORITY_MAX) * 100)}%` }} />
        </div>
      </div>
    </div>
  );
}
