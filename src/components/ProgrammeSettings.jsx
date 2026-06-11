import { useState } from "react";
import { Button } from "./ui.jsx";
import { todayIso } from "../utils/dates.js";
import { CalendarDays, RefreshCw, ChevronDown, ChevronUp, Settings2 } from "lucide-react";

const STRATEGY_LABELS = {
  standard: "Standard order",
  group:    "Group by group",
  priority: "Priority first",
};

export function ProgrammeSettings({ programmeStart, detoxDuration = 14, introOrder, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [editDate, setEditDate] = useState(programmeStart);
  const [dirty, setDirty] = useState(false);
  const [restartDuration, setRestartDuration] = useState(detoxDuration);

  const today = todayIso();

  // Preview uses restartDuration so the date updates as the user toggles 7/14
  const reintroDate = (() => {
    const d = new Date(editDate);
    d.setDate(d.getDate() + restartDuration);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  })();

  function handleDateChange(val) {
    setEditDate(val);
    setDirty(val !== programmeStart);
  }

  function handleSave() {
    onUpdate({ programmeStart: editDate });
    setDirty(false);
  }

  function handleRestartDetox() {
    if (!confirm(
      `This will start a fresh ${restartDuration}-day detox from today.\n\nYour food logs and observations won't be changed — only the programme dates will update.\n\nContinue?`
    )) return;
    setEditDate(today);
    setDirty(false);
    onUpdate({ programmeStart: today, detoxDuration: restartDuration });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
            <Settings2 size={16} className="text-indigo-600" />
          </div>
          <div className="text-left">
            <div className="font-semibold text-sm text-slate-800">Programme settings</div>
            <div className="text-xs text-slate-500">
              Detox: {new Date(programmeStart).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              {" · "}
              {STRATEGY_LABELS[introOrder] || introOrder}
            </div>
          </div>
        </div>
        {open ? <ChevronUp size={15} className="text-slate-500" /> : <ChevronDown size={15} className="text-slate-500" />}
      </button>

      {open && (
        <div className="border-t border-slate-100 px-5 py-5 space-y-5 animate-fadeUp">
          {/* Date picker */}
          <div>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 block">
                <CalendarDays size={12} className="inline mr-1" />Detox start date
              </span>
              <input
                type="date"
                value={editDate}
                onChange={e => handleDateChange(e.target.value)}
                className="w-full max-w-xs rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
              />
            </label>
            <p className="text-xs text-slate-500 mt-1.5">
              Reintroduction starts: <b className="text-slate-600">{reintroDate}</b>
            </p>
          </div>

          {dirty && (
            <Button onClick={handleSave} size="sm" className="gap-1.5">
              Save dates
            </Button>
          )}

          {/* Restart detox */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="font-semibold text-sm text-amber-900 mb-1 flex items-center gap-2">
              <RefreshCw size={14} />
              Restart detox phase
            </div>
            <p className="text-xs text-amber-700 mb-3">
              If you broke the diet, restart a fresh detox from today.
              Your existing food observations and logs are preserved.
            </p>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-amber-800">Duration:</span>
              {[7, 14].map(d => (
                <button
                  key={d}
                  onClick={() => setRestartDuration(d)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                    restartDuration === d
                      ? "bg-amber-600 text-white"
                      : "bg-white border border-amber-300 text-amber-700 hover:bg-amber-100"
                  }`}
                >
                  {d} days
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRestartDetox}
              className="border-amber-300 text-amber-800 hover:bg-amber-100 gap-1.5"
            >
              <RefreshCw size={13} />
              Restart {restartDuration}-day detox from today
            </Button>
          </div>

          {/* Strategy info */}
          <div className="text-xs text-slate-500">
            <b className="text-slate-600">Current food order strategy:</b>{" "}
            {STRATEGY_LABELS[introOrder] || introOrder}.{" "}
            To change food order, drag rows in the Food list tab.
          </div>
        </div>
      )}
    </div>
  );
}
