import { useState } from "react";
import { Card, CardContent, Button } from "../ui.jsx";
import { todayIso as today } from "../../utils/dates.js";
import { Plus, Trash2 } from "lucide-react";

const TORSO = [
  { key: "waist", label: "Waist" },
  { key: "hips",  label: "Hips" },
  { key: "chest", label: "Chest" },
  { key: "abdomen", label: "Abdomen" },
];

const LIMB = [
  { key: "armL",   label: "Arm L" },
  { key: "armR",   label: "Arm R" },
  { key: "thighL", label: "Thigh L" },
  { key: "thighR", label: "Thigh R" },
];

const BUILTIN_FIELDS = [...TORSO, ...LIMB];
const RESERVED_KEYS = new Set(["date", ...BUILTIN_FIELDS.map(f => f.key)]);

function toCm(inches) {
  return +(inches * 2.54).toFixed(2);
}

function slugify(label) {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function makeFieldId(label, existing) {
  const base = slugify(label) || "field";
  let candidate = `custom_${base}`;
  let i = 2;
  const taken = new Set([
    ...RESERVED_KEYS,
    ...existing.map(f => f.id),
  ]);
  while (taken.has(candidate)) {
    candidate = `custom_${base}_${i++}`;
  }
  return candidate;
}

export function MeasurementLogger({
  measurements,
  unit,
  onUnitChange,
  onChange,
  customFields = [],
  onCustomFieldsChange,
}) {
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [addError, setAddError] = useState("");
  const [dateError, setDateError] = useState("");

  function logMeasurements(e) {
    e.preventDefault();

    const form = new FormData(e.currentTarget);
    const date = form.get("date");

    if (!date) return;

    if (date > today()) {
      setDateError("You can't log measurements for a future date.");
      return;
    }
    setDateError("");

    const entry = { date };
    const allFields = [...BUILTIN_FIELDS, ...customFields.map(f => ({ key: f.id, label: f.label }))];

    allFields.forEach(field => {
      const raw = form.get(field.key);

      const value = raw === "" || raw == null ? null : Number(raw);

      entry[field.key] =
        value === null || Number.isNaN(value)
          ? null
          : unit === "in"
          ? toCm(value)
          : value;
    });

    const nextMeasurements = measurements
      .filter(item => item.date !== date)
      .concat(entry)
      .sort((a, b) => a.date.localeCompare(b.date));

    onChange(nextMeasurements);

    e.currentTarget.reset();
  }

  function addCustomField() {
    const label = newFieldLabel.trim();
    if (!label) { setAddError("Enter a name for the measurement."); return; }
    if (label.length > 40) { setAddError("Keep the name under 40 characters."); return; }

    const duplicate = customFields.some(f => f.label.toLowerCase() === label.toLowerCase())
      || BUILTIN_FIELDS.some(f => f.label.toLowerCase() === label.toLowerCase());
    if (duplicate) { setAddError("A measurement with that name already exists."); return; }

    const id = makeFieldId(label, customFields);
    onCustomFieldsChange?.([...customFields, { id, label }]);
    setNewFieldLabel("");
    setAddError("");
  }

  function removeCustomField(id) {
    onCustomFieldsChange?.(customFields.filter(f => f.id !== id));
  }

  function renderGroup(label, fields, options = {}) {
    return (
      <div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">
          {label}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {fields.map(field => (
            <label key={field.key} className="text-sm font-medium text-slate-700 relative group">
              <span className="flex items-center justify-between gap-1">
                <span className="truncate">{field.label} ({unit})</span>
                {options.removable && (
                  <button
                    type="button"
                    onClick={() => removeCustomField(field.key)}
                    aria-label={`Remove ${field.label}`}
                    title="Remove this custom measurement"
                    className="text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </span>
              <input
                name={field.key}
                type="number"
                step={unit === "cm" ? "0.1" : "0.05"}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.30)] transition-shadow"
              />
            </label>
          ))}
        </div>
      </div>
    );
  }

  const customGroupFields = customFields.map(f => ({ key: f.id, label: f.label }));

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
          <h2 className="font-semibold text-lg">
            Log measurements
          </h2>

          <div className="flex gap-2">
            <Button
              variant={unit === "cm" ? "default" : "outline"}
              onClick={() => onUnitChange("cm")}
            >
              cm
            </Button>

            <Button
              variant={unit === "in" ? "default" : "outline"}
              onClick={() => onUnitChange("in")}
            >
              inches
            </Button>
          </div>
        </div>

        <form onSubmit={logMeasurements} className="space-y-4">
          <label className="text-sm font-medium block max-w-xs text-slate-700">
            Date
            <input
              name="date"
              type="date"
              defaultValue={today()}
              max={today()}
              onChange={() => dateError && setDateError("")}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.30)] transition-shadow"
            />
            {dateError && <p className="text-xs text-rose-600 mt-1">{dateError}</p>}
          </label>

          {renderGroup("Torso measurements", TORSO)}

          <div className="h-px bg-slate-100" />

          {renderGroup("Limb measurements", LIMB)}

          {customGroupFields.length > 0 && (
            <>
              <div className="h-px bg-slate-100" />
              {renderGroup("Custom measurements", customGroupFields, { removable: true })}
            </>
          )}

          <div className="h-px bg-slate-100" />

          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">
              Add a custom measurement
            </div>
            <p className="text-xs text-slate-500 mb-2 leading-relaxed">
              Track anything else you want — e.g. <em>Abdomen (sitting)</em>, <em>Neck</em>, <em>Calf L</em>.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newFieldLabel}
                onChange={e => { setNewFieldLabel(e.target.value); if (addError) setAddError(""); }}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomField();
                  }
                }}
                placeholder="Measurement name"
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.30)] transition-shadow"
              />
              <Button type="button" variant="outline" onClick={addCustomField} className="sm:w-auto">
                <Plus size={14} className="mr-1" /> Add field
              </Button>
            </div>
            {addError && <p className="text-xs text-rose-600 mt-1.5">{addError}</p>}
          </div>

          <Button type="submit">
            Save measurements
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
