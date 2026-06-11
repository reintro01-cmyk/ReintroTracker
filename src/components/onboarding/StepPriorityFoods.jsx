export function StepPriorityFoods({ priorityFoods, togglePriorityFood, search, setSearch, filteredFoods }) {
  return (
    <div className="space-y-4 animate-fadeUp">
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-1">Choose your priority foods</h2>
        <p className="text-sm text-slate-500">
          These go to the top of your schedule. Select the foods you miss most or need to test first.
        </p>
      </div>

      <input
        type="text" placeholder="Search foods…" value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
      />

      <div className="max-h-56 overflow-y-auto pr-1 space-y-1">
        {filteredFoods.map(food => (
          <label
            key={food.id}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
              priorityFoods.includes(food.id) ? "border-indigo-200 bg-indigo-50" : "border-slate-100 bg-white hover:border-slate-200"
            }`}
          >
            <input
              type="checkbox" className="accent-indigo-600 w-4 h-4 shrink-0"
              checked={priorityFoods.includes(food.id)}
              onChange={() => togglePriorityFood(food.id)}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-800">{food.name}</div>
              <div className="text-xs text-slate-500">{food.group}</div>
            </div>
          </label>
        ))}
      </div>

      {priorityFoods.length > 0 && (
        <div className="text-xs text-indigo-600 font-semibold">
          {priorityFoods.length} food{priorityFoods.length !== 1 ? "s" : ""} selected as priority
        </div>
      )}
    </div>
  );
}
