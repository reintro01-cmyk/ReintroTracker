import { WeightLogger } from "../body/WeightLogger.jsx";
import { MeasurementLogger } from "../body/MeasurementLogger.jsx";
import { Scale } from "lucide-react";

export function ProfileTab({ body, onBodyChange }) {
  return (
    <div className="max-w-7xl 2xl:max-w-[1400px] mx-auto animate-fadeUp">
      <div className="mb-5">
        <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">Profile</div>
        <h1 className="text-xl font-bold text-slate-900">Body tracking</h1>
        <p className="text-sm text-slate-500 mt-0.5">Log your weight and measurements. Head to Reports to see your trends.</p>
      </div>
      <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-5 lg:space-y-0">

        {/* Weight column */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Scale size={14} className="text-indigo-500 shrink-0" />
            <span className="text-sm font-bold text-indigo-700">Weight log</span>
          </div>
          <WeightLogger
            weights={body.weights}
            onChange={weights => onBodyChange({ weights })}
          />
          {body.weights.length > 0 && (
            <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
              <div className="px-5 py-3 border-b border-slate-100">
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Recent entries</span>
              </div>
              <div className="px-5 py-3 space-y-1.5">
                {[...body.weights]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .slice(0, 6)
                  .map(w => (
                    <div key={w.date} className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">
                        {new Date(w.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      <span className="font-semibold text-slate-800 tabular-nums">{w.kg} kg</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Measurements column */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-sm font-bold text-emerald-700">Measurements</span>
          </div>
          <MeasurementLogger
            measurements={body.measurements}
            unit={body.unit}
            onUnitChange={unit => onBodyChange({ unit })}
            onChange={measurements => onBodyChange({ measurements })}
            customFields={body.customFields || []}
            onCustomFieldsChange={customFields => onBodyChange({ customFields })}
          />
        </div>

      </div>
    </div>
  );
}
