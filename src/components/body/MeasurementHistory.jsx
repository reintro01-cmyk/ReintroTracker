// Per-entry measurement log for the Reports page: shows each logged date with its values and
// lets the user edit or delete an entry (to fix mistakes). Values are stored in cm; we display
// and edit in the user's chosen unit, converting back to cm on save — matching MeasurementLogger.

import { useState } from "react";
import { Trash2, Pencil, Check, X } from "lucide-react";
import { todayIso } from "../../utils/dates.js";

const BUILTIN = [
  { key: "waist", label: "Waist" }, { key: "hips", label: "Hips" },
  { key: "chest", label: "Chest" }, { key: "abdomen", label: "Abdomen" },
  { key: "armL", label: "Arm L" }, { key: "armR", label: "Arm R" },
  { key: "thighL", label: "Thigh L" }, { key: "thighR", label: "Thigh R" },
];

const longDate = iso =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

export function MeasurementHistory({ measurements = [], customFields = [], unit = "cm", onChange }) {
  const [editDate, setEditDate] = useState(null);
  const [draft, setDraft] = useState({});

  const fields = [...BUILTIN, ...customFields.map(f => ({ key: f.id, label: f.label }))];
  const toDisplay = v => Math.round((unit === "in" ? v / 2.54 : v) * 10) / 10;
  const toStored = v => (unit === "in" ? +(v * 2.54).toFixed(2) : v);

  if (!measurements.length) {
    return <p className="text-sm text-slate-500">No measurement entries yet. Log them in <span className="font-semibold text-slate-600">Profile → Measurements</span>.</p>;
  }

  const sorted = [...measurements].sort((a, b) => b.date.localeCompare(a.date));

  function startEdit(entry) {
    const d = { date: entry.date };
    for (const f of fields) d[f.key] = entry[f.key] != null ? String(toDisplay(entry[f.key])) : "";
    setDraft(d);
    setEditDate(entry.date);
  }

  function cancelEdit() { setEditDate(null); setDraft({}); }

  function saveEdit(origDate) {
    const newDate = draft.date || origDate;
    if (newDate > todayIso()) return;
    const entry = { date: newDate };
    for (const f of fields) {
      const raw = draft[f.key];
      const v = raw === "" || raw == null ? null : Number(raw);
      entry[f.key] = v == null || Number.isNaN(v) ? null : toStored(v);
    }
    // Drop the original row (and any row already on the new date) before re-inserting, so editing
    // the date onto an existing entry merges rather than creating a duplicate date.
    const next = measurements
      .filter(m => m.date !== origDate && m.date !== newDate)
      .concat(entry)
      .sort((a, b) => a.date.localeCompare(b.date));
    onChange(next);
    cancelEdit();
  }

  function remove(date) {
    if (!confirm("Delete this measurement entry? This can’t be undone.")) return;
    onChange(measurements.filter(m => m.date !== date));
    if (editDate === date) cancelEdit();
  }

  return (
    <div className="space-y-2">
      {sorted.map(entry => {
        const editing = editDate === entry.date;

        if (editing) {
          const future = (draft.date || entry.date) > todayIso();
          return (
            <div key={entry.date} className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 space-y-3">
              <label className="text-xs font-semibold text-slate-600 block">
                Date
                <input type="date" value={draft.date} max={todayIso()}
                  onChange={e => setDraft(d => ({ ...d, date: e.target.value }))}
                  className="mt-1 block rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {fields.map(f => (
                  <label key={f.key} className="text-xs font-medium text-slate-600">
                    {f.label} ({unit})
                    <input type="number" step={unit === "cm" ? "0.1" : "0.05"} value={draft[f.key] ?? ""}
                      onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
                  </label>
                ))}
              </div>
              {future && <p className="text-xs text-rose-600">You can’t use a future date.</p>}
              <div className="flex items-center gap-2">
                <button onClick={() => saveEdit(entry.date)} disabled={future}
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40 active:scale-95 transition-all">
                  <Check size={13} /> Save
                </button>
                <button onClick={cancelEdit}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 active:scale-95 transition-all">
                  <X size={13} /> Cancel
                </button>
              </div>
            </div>
          );
        }

        const present = fields.filter(f => entry[f.key] != null && !Number.isNaN(Number(entry[f.key])));
        return (
          <div key={entry.date} className="rounded-xl border border-slate-200 p-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-800">{longDate(entry.date)}</div>
              {present.length ? (
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                  {present.map(f => (
                    <span key={f.key}>
                      <span className="text-slate-400">{f.label}</span>{" "}
                      <span className="font-semibold text-slate-700 tabular-nums">{toDisplay(entry[f.key])}{unit}</span>
                    </span>
                  ))}
                </div>
              ) : <div className="text-[11px] text-slate-400 mt-1">No values recorded</div>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => startEdit(entry)} aria-label={`Edit entry for ${longDate(entry.date)}`} title="Edit"
                className="text-slate-400 hover:text-indigo-600 inline-flex items-center justify-center min-h-9 min-w-9 rounded-lg hover:bg-slate-100 transition-colors">
                <Pencil size={14} />
              </button>
              <button onClick={() => remove(entry.date)} aria-label={`Delete entry for ${longDate(entry.date)}`} title="Delete"
                className="text-slate-400 hover:text-rose-600 inline-flex items-center justify-center min-h-9 min-w-9 rounded-lg hover:bg-slate-100 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
