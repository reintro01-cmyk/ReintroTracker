import { NAV_ITEMS } from "./AppSidebar.jsx";

const BOTTOM_NAV_ITEMS = NAV_ITEMS;

export function BottomNav({ tab, onTabChange, stats }) {
  return (
    <nav aria-label="Bottom" className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-100 z-30 flex">
      {BOTTOM_NAV_ITEMS.map(item => {
        const active = tab === item.id;
        const badge = item.id === "schedule" ? stats.active : null;
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            aria-current={active ? "page" : undefined}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 relative transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 focus-visible:outline-none ${
              active ? "text-indigo-600" : "text-slate-500"
            }`}
          >
            {active && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-indigo-600 rounded-full" />
            )}
            <item.icon
              size={18}
              strokeWidth={active ? 2.5 : 1.75}
            />
            <span className="text-[9px] font-semibold leading-none">{item.label}</span>
            {badge != null && !active && (
              <span className="absolute top-1.5 right-[calc(50%-18px)] w-4 h-4 flex items-center justify-center text-[9px] font-bold rounded-full bg-indigo-600 text-white leading-none">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
