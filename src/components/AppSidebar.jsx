import { getCurrentPhase } from "../utils/mealPlanner.js";
import {
  Home, CalendarDays, BookOpen, UserCircle, Leaf,
  BarChart2, Utensils
} from "lucide-react";

// Profile lives in the top-right header (next to Settings) instead of the main nav, so the
// primary nav stays focused on the daily flow (Home → Log → Schedule → Recipes → Reports).
export const NAV_ITEMS = [
  { id: "home",       label: "Home",       icon: Home },
  { id: "log",        label: "Log",        icon: Utensils },
  { id: "schedule",   label: "Schedule",   icon: CalendarDays },
  { id: "recipes",    label: "Recipes",    icon: BookOpen },
  { id: "reports",    label: "Reports",    icon: BarChart2 },
];

const PHASE_STYLE = {
  pre: {
    bg:        "bg-indigo-100",
    text:      "text-indigo-800",
    dot:       "bg-indigo-500",
    label:     "Pre-programme",
    sideBorder:"border-l-indigo-500",
  },
  detox: {
    bg:        "bg-amber-200/70",
    text:      "text-amber-900",
    dot:       "bg-amber-500",
    label:     "Detox Phase",
    sideBorder:"border-l-amber-500",
  },
  reintro: {
    bg:        "bg-emerald-100",
    text:      "text-emerald-800",
    dot:       "bg-emerald-500",
    label:     "Reintroduction",
    sideBorder:"border-l-emerald-500",
  },
};

function PhasePill({ phaseInfo }) {
  const s = PHASE_STYLE[phaseInfo.phase] || PHASE_STYLE.pre;
  const sub = phaseInfo.phase === "detox"
    ? `Day ${phaseInfo.day} of ${phaseInfo.totalDays}`
    : phaseInfo.phase === "reintro"
    ? `Day ${phaseInfo.day}`
    : phaseInfo.daysUntilStart != null
    ? `Starts in ${phaseInfo.daysUntilStart}d`
    : "";
  return (
    <div className={`${s.bg} ${s.text} rounded-xl px-3 py-3 mx-2`}>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${s.dot} shrink-0`} />
        <span className="text-sm font-bold leading-none">{s.label}</span>
      </div>
      {sub && <div className="text-xs font-semibold opacity-70 mt-1 ml-4">{sub}</div>}
    </div>
  );
}

export function AppSidebar({ tab, onTabChange, stats, session, syncStatus, phaseInfo }) {
  const s = (phaseInfo && PHASE_STYLE[phaseInfo.phase]) || PHASE_STYLE.pre;
  return (
    <aside
      className={`hidden lg:flex flex-col fixed inset-y-0 left-0 w-56 bg-white border-r border-slate-100 border-l-[3px] ${s.sideBorder} z-20`}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-14 border-b border-slate-100 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
          <Leaf size={13} className="text-white" />
        </div>
        <div>
          <div className="text-sm font-bold text-slate-900 leading-tight">Reintro</div>
          <div className="text-[10px] text-slate-500 leading-tight font-medium">Tracker</div>
        </div>
      </div>

      {/* Phase badge */}
      {phaseInfo && (
        <div className="pt-3 pb-1">
          <PhasePill phaseInfo={phaseInfo} />
        </div>
      )}

      {/* Nav */}
      <nav aria-label="Primary" className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(item => {
          const active = tab === item.id;
          const badge = item.id === "schedule" ? stats.active : null;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              aria-current={active ? "page" : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-100 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
                active
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <item.icon
                size={16}
                strokeWidth={active ? 2.5 : 1.75}
                className={active ? "text-white" : "text-slate-500"}
              />
              <span className="flex-1 text-left">{item.label}</span>
              {badge != null && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-100 px-4 py-3.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <UserCircle size={14} className="text-indigo-600" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-700 truncate">
              {session?.user?.email ? session.user.email.split("@")[0] : "Not signed in"}
            </div>
            <div className={`text-[10px] leading-tight truncate ${
              syncStatus.includes("✓") || syncStatus.includes("Synced")
                ? "text-emerald-700"
                : "text-slate-500"
            }`}>
              {syncStatus}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
