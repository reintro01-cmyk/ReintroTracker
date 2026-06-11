import { CalendarDays } from "lucide-react";

export function StepStartDate({ startDate, setStartDate, reintroDate }) {
  return (
    <div className="space-y-5 animate-fadeUp">
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-1">When does your detox start?</h2>
        <p className="text-sm text-slate-500">
          The 14-day detox phase is the foundation — strict foods only. Reintroduction begins on day 15.
        </p>
      </div>

      <label className="block">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 block">
          <CalendarDays size={12} className="inline mr-1" />Detox start date
        </span>
        <input
          type="date" value={startDate}
          onChange={e => setStartDate(e.target.value)}
          className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-base font-semibold focus:outline-none focus:border-indigo-400 transition-colors"
        />
        <span className="mt-2 block text-xs text-slate-500">
          Already a few days in? Pick a past date and we'll place you on the right day.
        </span>
      </label>

      <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800 space-y-1">
        <div className="font-semibold">📅 Your timeline</div>
        <div className="text-xs text-indigo-600 space-y-0.5">
          <div>Detox phase: <b>{new Date(startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</b> → 14 days</div>
          <div>Reintroduction starts: <b>{reintroDate}</b></div>
          <div className="opacity-70">Two-day cycle per food: introduce → observe</div>
        </div>
      </div>
    </div>
  );
}
