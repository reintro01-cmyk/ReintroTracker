const PILL_STYLES = {
  "Dairy":                         { border: "border-yellow-400",   text: "text-yellow-700",   hover: "hover:bg-yellow-100",   active: "bg-yellow-400 border-yellow-400 text-white" },
  "Animal protein":                { border: "border-orange-400",   text: "text-orange-700",   hover: "hover:bg-orange-100",   active: "bg-orange-500 border-orange-500 text-white" },
  "Grains / carbs":                { border: "border-green-500",    text: "text-green-700",    hover: "hover:bg-green-100",    active: "bg-green-500 border-green-500 text-white" },
  "Dals / pulses / nuts / seeds":  { border: "border-purple-500",   text: "text-purple-700",   hover: "hover:bg-purple-100",   active: "bg-purple-500 border-purple-500 text-white" },
  "Vegetables":                    { border: "border-emerald-500",  text: "text-emerald-700",  hover: "hover:bg-emerald-100",  active: "bg-emerald-500 border-emerald-500 text-white" },
  "Fruits":                        { border: "border-rose-500",     text: "text-rose-700",     hover: "hover:bg-rose-100",     active: "bg-rose-500 border-rose-500 text-white" },
  "Oils / fats":                   { border: "border-pink-500",     text: "text-pink-700",     hover: "hover:bg-pink-100",     active: "bg-pink-500 border-pink-500 text-white" },
  "Spices / masala":               { border: "border-fuchsia-500",  text: "text-fuchsia-700",  hover: "hover:bg-fuchsia-100",  active: "bg-fuchsia-500 border-fuchsia-500 text-white" },
  "Condiments / bases":            { border: "border-sky-500",      text: "text-sky-700",      hover: "hover:bg-sky-100",      active: "bg-sky-500 border-sky-500 text-white" },
  "Processed / outside food":      { border: "border-stone-500",    text: "text-stone-700",    hover: "hover:bg-stone-100",    active: "bg-stone-500 border-stone-500 text-white" },
  "Drinks":                        { border: "border-blue-500",     text: "text-blue-700",     hover: "hover:bg-blue-100",     active: "bg-blue-500 border-blue-500 text-white" },
  "Sweeteners":                    { border: "border-amber-400",    text: "text-amber-700",    hover: "hover:bg-amber-100",    active: "bg-amber-400 border-amber-400 text-white" },
};

export function Legend({ groupColors, selected, onSelect }) {
  const active = selected ?? "All";

  return (
    <div className="flex flex-wrap gap-1.5 p-1">
      <button
        type="button"
        onClick={() => onSelect?.("All")}
        aria-pressed={active === "All"}
        className={`text-xs px-3 py-1 rounded-full border font-semibold transition-colors ${
          active === "All"
            ? "bg-indigo-600 border-indigo-600 text-white"
            : "bg-white border-indigo-300 text-indigo-700 hover:bg-indigo-50"
        }`}
      >
        All
      </button>
      {Object.keys(groupColors).map(group => {
        const s = PILL_STYLES[group];
        const isActive = active === group;
        return (
          <button
            key={group}
            type="button"
            onClick={() => onSelect?.(isActive ? "All" : group)}
            aria-pressed={isActive}
            className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
              isActive
                ? s.active
                : `bg-white ${s.border} ${s.text} ${s.hover}`
            }`}
          >
            {group}
          </button>
        );
      })}
    </div>
  );
}
