import { todayIso } from "../utils/dates.js";

const STATUS_COLORS = {
  Safe:  "bg-emerald-50 border-emerald-300 text-emerald-950",
  Limit: "bg-amber-50 border-amber-300 text-amber-950",
  Avoid: "bg-rose-50 border-rose-300 text-rose-950",
};

const STATUS_DOTS = {
  Safe:  "bg-emerald-500",
  Limit: "bg-amber-500",
  Avoid: "bg-rose-500",
};

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthView({ month, status, onSelect, groupColors, recentlyClearedFoodId }) {
  const first = month.items[0].date;
  const title = first.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const todayIsoStr = todayIso();

  return (
    <div className="animate-fadeUp">
      <h2 className="text-base font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">
        {title}
      </h2>

      {/* Day-of-week headers — only meaningful in the 7-col layout */}
      <div className="hidden lg:grid grid-cols-7 gap-2 mb-2 px-1">
        {DOW.map(d => (
          <span
            key={d}
            className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center"
          >
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {month.items.map(item => {
          const foodStatus = status[item.food.id] || "Pending";
          const isToday    = item.iso === todayIsoStr;
          const isObserve  = item.type === "Observe";
          const hasStatus  = foodStatus !== "Pending";

          // Introduce: filled pastel category background.
          // Observe: lighter (40% opacity) version + dashed border.
          const baseColor = STATUS_COLORS[foodStatus] || groupColors[item.food.group] || "bg-white border-slate-200";

          const observeMods = isObserve && !hasStatus
            ? "opacity-60 border-dashed"
            : "";

          const wasJustCleared = recentlyClearedFoodId && recentlyClearedFoodId === item.food.id && foodStatus === "Safe";

          return (
            <button
              key={`${item.iso}-${item.type}`}
              onClick={() => onSelect(item)}
              className={`
                relative text-left min-h-[112px] rounded-2xl border-2 p-3
                hover:shadow-md hover:scale-[1.02] active:scale-100
                transition-all duration-150 ${baseColor} ${observeMods}
                ${isToday ? "ring-2 ring-indigo-500 ring-offset-1" : ""}
                ${wasJustCleared ? "animate-safe-flash" : ""}
              `}
            >
              {isToday && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              )}

              {/* Status dot top-right (replaces Pending badge for foods with a verdict) */}
              {!isToday && hasStatus && (
                <span
                  className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-sm ${STATUS_DOTS[foodStatus]}`}
                  aria-label={foodStatus}
                />
              )}

              <div className="font-extrabold text-lg leading-none">
                {item.date.getDate()}
              </div>

              <div className="text-[10px] uppercase tracking-wider font-bold mt-1.5 opacity-60">
                {item.type}
              </div>

              <div className="text-sm font-semibold mt-1 leading-snug">
                {item.food.name}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
