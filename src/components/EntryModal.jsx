import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "./ui.jsx";
import { displayDate, iso } from "../utils/dates.js";
import { parseLocalIso } from "../utils/schedule.js";
import { Pin, ChevronDown, ChevronUp, Utensils, Activity, Check } from "lucide-react";

const SYMPTOMS = [
  "Bloating", "Gas", "Loose stool", "Constipation",
  "Skin rash/acne", "Itching/swelling", "Joint ache", "Fatigue",
  "Brain fog", "Reflux", "Cramps", "Headache"
];

const VERDICTS = [
  { value: "Safe",  label: "✓ Safe",  cls: "border-emerald-400 bg-emerald-50 text-emerald-800" },
  { value: "Limit", label: "△ Limit", cls: "border-amber-400 bg-amber-50 text-amber-800" },
  { value: "Avoid", label: "✕ Avoid", cls: "border-rose-400 bg-rose-50 text-rose-800" },
];

function Field({ label, value, onChange, type = "text", placeholder = "" }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
      <input
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
      />
    </label>
  );
}

function Textarea({ label, value, onChange }) {
  return (
    <label className="flex flex-col gap-1 md:col-span-2">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
      <textarea
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-indigo-400 transition resize-none"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </label>
  );
}

export function EntryModal({ selected, intake, observation, status, pinnedDate, pinnedFoods = {}, skipObserve = false, reintroStart, schedule = [], onClose, onSaveIntake, onSaveObservation, onSetObserveDay, onPinDate, onUnpin }) {
  const dialogRef = useRef(null);

  // The only valid days to pin to are the schedule's "Introduce" slots (the 2-day cadence).
  // Listing them directly means the user picks a real reintroduction day instead of any date
  // that then silently snaps. Trimmed to a window around this food's current slot — big moves
  // use the reorder-by-group tool instead.
  const pinOptions = useMemo(() => (schedule || [])
    .filter(s => s.type === "Introduce")
    .map(s => {
      const isSelf = s.food.id === selected.food.id;
      const pinnedByOther = !!pinnedFoods?.[s.food.id] && !isSelf;
      return {
        iso: iso(s.date),
        self: isSelf,
        label: `${displayDate(s.date)} — ${isSelf ? "this food" : s.food.name}${pinnedByOther ? " · pinned" : ""}`,
        disabled: pinnedByOther,
      };
    }), [schedule, selected.food.id, pinnedFoods]);

  // Custom dropdown (the native <select> popup scrolls unreliably for long lists). A fixed-height
  // scrollable panel that opens to the food's current day.
  const [pinMenuOpen, setPinMenuOpen] = useState(false);
  const pinMenuRef = useRef(null);
  const pinListRef = useRef(null);
  // Staged locally — the pin is only applied to the schedule when the user saves (or discarded
  // on Cancel). Picking a date no longer reorders the schedule immediately.
  const [pendingPin, setPendingPin] = useState(pinnedDate || "");
  const pinLabel = pendingPin
    ? (pinOptions.find(o => o.iso === pendingPin)?.label || displayDate(parseLocalIso(pendingPin)))
    : "Pick a reintroduction day…";

  useEffect(() => {
    if (!pinMenuOpen) return;
    function onDown(e) { if (pinMenuRef.current && !pinMenuRef.current.contains(e.target)) setPinMenuOpen(false); }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [pinMenuOpen]);

  useEffect(() => {
    if (pinMenuOpen && pinListRef.current) {
      pinListRef.current.querySelector('[data-self="true"]')?.scrollIntoView({ block: "center" });
    }
  }, [pinMenuOpen]);

  // Focus trap — recomputes focusables each Tab so the optional collapsible section is included.
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const getFocusable = () => el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    getFocusable()[0]?.focus();
    function handler(e) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const f = getFocusable();
      if (!f.length) { e.preventDefault(); return; }
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const isIntroduce = selected.type === "Introduce";

  // Both sub-forms are held independently (per-food, never date-bound), so we can write either
  // or both on save. The primary one matches the day type; the other is an optional add-on.
  const [intakeForm, setIntakeForm] = useState(() => ({
    quantity: intake?.quantity || "",
    time: intake?.time || "",
    meal: intake?.meal || "",
    prep: intake?.prep || "",
    notes: intake?.notes || "",
  }));
  const [obsForm, setObsForm] = useState(() => ({
    verdict: observation?.verdict || status || "Pending",
    severity: observation?.severity || "",
    bowel: observation?.bowel || "",
    context: observation?.context || "",
    symptoms: observation?.symptoms || [],
    noSideEffects: observation?.noSideEffects || false,
    notes: observation?.notes || "",
  }));
  const [extraOpen, setExtraOpen] = useState(false);
  // Per-food cadence (Introduce flow): keep the observation day tomorrow (default), or skip it
  // and record the reaction inline today.
  const [wantObserveDay, setWantObserveDay] = useState(!skipObserve);

  const setIntake = (k, v) => setIntakeForm(prev => ({ ...prev, [k]: v }));
  const setObs = (k, v) => setObsForm(prev => ({ ...prev, [k]: v }));

  function toggleSymptom(symptom) {
    setObsForm(prev => {
      const symptoms = prev.symptoms.includes(symptom)
        ? prev.symptoms.filter(s => s !== symptom)
        : [...prev.symptoms, symptom];
      return { ...prev, symptoms, noSideEffects: symptoms.length === 0 ? prev.noSideEffects : false };
    });
  }

  function toggleNoSideEffects() {
    setObsForm(prev => ({
      ...prev,
      noSideEffects: !prev.noSideEffects,
      symptoms: !prev.noSideEffects ? [] : prev.symptoms,
      severity: !prev.noSideEffects ? "0" : prev.severity,
      verdict: !prev.noSideEffects ? "Safe" : prev.verdict,
    }));
  }

  const intakeFilled = !!(intakeForm.quantity || intakeForm.time || intakeForm.meal || intakeForm.prep || intakeForm.notes);
  const obsDecided = ["Safe", "Limit", "Avoid"].includes(obsForm.verdict);
  const needsVerdict = isIntroduce && !wantObserveDay;          // verdict captured inline, required
  const saveBlocked = needsVerdict && !obsDecided;
  const willRecordReaction = isIntroduce && (needsVerdict || (extraOpen && obsDecided));

  function submit(e) {
    e.preventDefault();
    if (saveBlocked) return;
    const savedAt = new Date().toISOString();
    if (isIntroduce) onSetObserveDay?.(selected.food.id, wantObserveDay);
    // Intake always saves on the Introduce flow (and on the optional add-on for Observe).
    const saveIntake = isIntroduce || (extraOpen && intakeFilled);
    // Observation saves as the primary (Observe), inline (no-observe Introduce), or opt-in add-on.
    const saveObs = !isIntroduce || (needsVerdict && obsDecided) || (extraOpen && obsDecided);
    if (saveIntake) onSaveIntake(selected.food.id, { ...intakeForm, savedAt });
    if (saveObs) onSaveObservation(selected.food.id, obsForm.verdict, { ...obsForm, savedAt });
    // Apply the staged pin change only now, on save.
    const currentPin = pinnedDate || "";
    if (onPinDate && pendingPin !== currentPin) {
      if (pendingPin) onPinDate(selected.food.id, pendingPin);
      else onUnpin?.(selected.food.id);
    }
    onClose();
  }

  const accentCls = isIntroduce ? "from-indigo-600 to-indigo-500" : "from-sky-600 to-sky-500";

  const intakeFields = () => (
    <div className="grid md:grid-cols-2 gap-4">
      <Field label="Actual quantity eaten" value={intakeForm.quantity} onChange={v => setIntake("quantity", v)} placeholder="e.g., 100g / 1 cup" />
      <Field label="Time eaten" value={intakeForm.time} onChange={v => setIntake("time", v)} type="time" />
      <Field label="Meal" value={intakeForm.meal} onChange={v => setIntake("meal", v)} placeholder="Breakfast / lunch / dinner" />
      <Field label="Preparation" value={intakeForm.prep} onChange={v => setIntake("prep", v)} placeholder="plain / boiled / cooked" />
      <Textarea label="Food notes" value={intakeForm.notes} onChange={v => setIntake("notes", v)} />
    </div>
  );

  const obsFields = () => (
    <div className="space-y-5">
      {/* Severity slider */}
      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Symptom severity (0 = none, 5 = severe)
        </div>
        <div className="flex items-center gap-3">
          <input
            type="range" min={0} max={5} step={1}
            value={obsForm.severity || 0}
            aria-label="Symptom severity, 0 (none) to 5 (severe)"
            aria-valuetext={`${obsForm.severity || 0} of 5`}
            onChange={e => {
              const num = Number(e.target.value);
              const verdict = num === 0 ? "Safe" : num <= 3 ? "Limit" : "Avoid";
              setObsForm(prev => ({ ...prev, severity: String(num), verdict }));
            }}
            className="flex-1 accent-indigo-600"
          />
          <span className="w-6 text-center font-bold text-slate-700">{obsForm.severity || 0}</span>
        </div>
      </div>

      {/* Verdict selector */}
      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Verdict</div>
        <div className="flex gap-2" role="group" aria-label="Verdict">
          {VERDICTS.map(v => (
            <button
              key={v.value}
              type="button"
              onClick={() => setObs("verdict", v.value)}
              aria-pressed={obsForm.verdict === v.value}
              className={`flex-1 rounded-lg border-2 py-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                obsForm.verdict === v.value ? v.cls : "border-slate-200 text-slate-500 hover:border-slate-300"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* No side effects toggle */}
      <label className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 cursor-pointer">
        <input type="checkbox" checked={obsForm.noSideEffects} onChange={toggleNoSideEffects}
          className="w-4 h-4 accent-emerald-600" />
        <div>
          <div className="text-sm font-semibold text-emerald-800">No side effects</div>
          <div className="text-xs text-emerald-700">Clears all symptoms and sets verdict to Safe</div>
        </div>
      </label>

      {/* Symptoms grid */}
      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Symptoms observed</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {SYMPTOMS.map(s => (
            <label
              key={s}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-all ${
                obsForm.symptoms.includes(s)
                  ? "border-rose-300 bg-rose-50 text-rose-800"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              } ${obsForm.noSideEffects ? "opacity-40 pointer-events-none" : ""}`}
            >
              <input
                type="checkbox"
                checked={obsForm.symptoms.includes(s)}
                disabled={obsForm.noSideEffects}
                onChange={() => toggleSymptom(s)}
                className="accent-rose-600 w-3.5 h-3.5"
              />
              {s}
            </label>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Bowel movement" value={obsForm.bowel} onChange={v => setObs("bowel", v)} placeholder="normal / loose / constipated" />
        <Field label="Sleep / stress context" value={obsForm.context} onChange={v => setObs("context", v)} />
        <Textarea label="Observation notes" value={obsForm.notes} onChange={v => setObs("notes", v)} />
      </div>
    </div>
  );

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="entry-modal-title"
      className="fixed inset-0 bg-slate-950/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-scaleIn"
    >
      <form
        onSubmit={submit}
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl overflow-hidden max-h-[92dvh] flex flex-col"
      >
        {/* Coloured header strip */}
        <div className={`bg-gradient-to-r ${accentCls} px-6 py-4 shrink-0`}>
          <div className="text-xs font-semibold uppercase tracking-widest text-white/85 mb-0.5">
            {selected.type} Day · {displayDate(selected.date)}
          </div>
          <h2 id="entry-modal-title" className="text-xl font-bold text-white">{selected.food.name}</h2>
          <p className="text-sm text-white/85 mt-0.5">
            {selected.food.group} · Planned: {selected.food.portion}
          </p>
        </div>

        {/* Pin-to-date — moves this food to a chosen introduce day (only valid days are listed) */}
        {onPinDate && reintroStart && (
          <div className="px-5 pt-4 shrink-0">
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold uppercase tracking-wide text-indigo-500 flex items-center gap-1">
                    <Pin size={12} /> Pin introduce date
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {pendingPin
                      ? pendingPin === (pinnedDate || "")
                        ? `Pinned to ${displayDate(parseLocalIso(pendingPin))}`
                        : `Will move to ${displayDate(parseLocalIso(pendingPin))} when you save`
                      : "Pick a reintroduction day — only valid days are shown; other foods flow around it."}
                  </div>
                </div>
                {pendingPin && (
                  <button
                    type="button"
                    onClick={() => setPendingPin("")}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-700 shrink-0"
                  >
                    Unpin
                  </button>
                )}
              </div>
              <div className="relative mt-2" ref={pinMenuRef}>
                <button
                  type="button"
                  onClick={() => setPinMenuOpen(o => !o)}
                  aria-haspopup="listbox"
                  aria-expanded={pinMenuOpen}
                  className="w-full flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <span className={pendingPin ? "text-slate-800" : "text-slate-500"}>{pinLabel}</span>
                  <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform ${pinMenuOpen ? "rotate-180" : ""}`} />
                </button>
                {pinMenuOpen && (
                  <div
                    ref={pinListRef}
                    role="listbox"
                    className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-white shadow-lg"
                  >
                    {pinOptions.map(o => (
                      <button
                        key={o.iso}
                        type="button"
                        role="option"
                        aria-selected={o.iso === pendingPin}
                        data-self={o.self ? "true" : undefined}
                        disabled={o.disabled}
                        onClick={() => { setPendingPin(o.iso); setPinMenuOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${
                          o.disabled
                            ? "text-slate-300 cursor-not-allowed"
                            : o.iso === pendingPin
                              ? "bg-indigo-50 text-indigo-700 font-semibold"
                              : "text-slate-700 hover:bg-indigo-50"
                        }`}
                      >
                        <span className="truncate">{o.label}</span>
                        {o.iso === pendingPin && <Check size={14} className="text-indigo-600 shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="p-5 overflow-y-auto flex-1 min-h-0 space-y-5">
          {isIntroduce ? (
            <>
              {intakeFields()}

              {/* Observation-day toggle: 2-day cadence (keep) vs record the reaction inline today. */}
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 cursor-pointer">
                <input type="checkbox" checked={wantObserveDay} onChange={e => setWantObserveDay(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-indigo-600" />
                <div>
                  <div className="text-sm font-semibold text-slate-800">Schedule an observation day tomorrow</div>
                  <div className="text-xs text-slate-500">
                    {wantObserveDay
                      ? "Keep the next day to log how you reacted."
                      : "No observation day — record your reaction now; the next food moves up a day."}
                  </div>
                </div>
              </label>

              {wantObserveDay ? (
                // Optional — log the reaction now anyway (the scheduled observe day still exists).
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <button type="button" onClick={() => setExtraOpen(o => !o)} aria-expanded={extraOpen}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <Activity size={15} className="text-sky-500" /> Also log your reaction
                      <span className="text-xs font-normal text-slate-500">same day · optional</span>
                    </span>
                    {extraOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                  </button>
                  {extraOpen && <div className="p-4 border-t border-slate-100">{obsFields()}</div>}
                </div>
              ) : (
                // Required — capture the verdict inline since there's no observe day.
                <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-4 space-y-4">
                  <div className="text-xs font-bold uppercase tracking-wide text-sky-700 flex items-center gap-1.5">
                    <Activity size={13} /> Your reaction — recorded today
                  </div>
                  {obsFields()}
                </div>
              )}
            </>
          ) : (
            <>
              {obsFields()}

              {/* Optional — backfill what was eaten on an observe-day entry. */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <button type="button" onClick={() => setExtraOpen(o => !o)} aria-expanded={extraOpen}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <Utensils size={15} className="text-indigo-500" /> Also log what you ate
                    <span className="text-xs font-normal text-slate-500">same day · optional</span>
                  </span>
                  {extraOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </button>
                {extraOpen && <div className="p-4 border-t border-slate-100">{intakeFields()}</div>}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col gap-2 p-5 pt-3 border-t border-slate-100 shrink-0">
          {saveBlocked && (
            <p className="text-xs text-amber-700 text-right">Pick a verdict (Safe / Limit / Avoid) to record your reaction.</p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saveBlocked}>
              {!isIntroduce ? "Save observation" : willRecordReaction ? "Save entry" : "Save intake"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
