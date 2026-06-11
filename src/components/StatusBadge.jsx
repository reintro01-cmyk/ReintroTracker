const CONFIG = {
  Safe:    { dot: "bg-emerald-500", bg: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  Limit:   { dot: "bg-amber-500",   bg: "bg-amber-50 text-amber-800 border-amber-200" },
  Avoid:   { dot: "bg-rose-500",    bg: "bg-rose-50 text-rose-800 border-rose-200" },
  Pending: { dot: "bg-slate-400",   bg: "bg-slate-100 text-slate-600 border-slate-200" },
};

export function StatusBadge({ status }) {
  const cfg = CONFIG[status] || CONFIG.Pending;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {status || "Pending"}
    </span>
  );
}
