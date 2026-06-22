import { FoodSensitivityReport } from "../FoodSensitivityReport.jsx";
import { BodySummary } from "../body/BodySummary.jsx";
import { WeightChart } from "../body/WeightChart.jsx";
import { WeeklyAverages } from "../body/WeeklyAverages.jsx";
import { BodyFatEstimate } from "../body/BodyFatEstimate.jsx";
import { MeasurementsReport } from "../body/MeasurementsReport.jsx";
import { MeasurementHistory } from "../body/MeasurementHistory.jsx";
import { BloodWorkReport } from "../body/BloodWorkReport.jsx";

export function ReportsTab({ foods, status, observations, body, onBodyChange, session }) {
  return (
    <div className="max-w-7xl 2xl:max-w-[1400px] mx-auto animate-fadeUp space-y-8">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">Analytics</div>
        <h1 className="text-xl font-bold text-slate-900">Reports</h1>
      </div>

      {/* Food sensitivity */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 shrink-0">Food sensitivity</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>
        <FoodSensitivityReport foods={foods} status={status} observations={observations} />
      </div>

      {/* Blood work */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 shrink-0">Blood work</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>
        <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
          <div className="bg-rose-50 border-b border-rose-100 px-5 py-4">
            <div className="text-[11px] font-bold uppercase tracking-widest text-rose-400 mb-0.5">Labs</div>
            <h2 className="font-bold text-base text-rose-900">Blood work & AI summary</h2>
            <p className="text-xs text-slate-500 mt-0.5">Upload a lab report to get a plain-language summary of what it says.</p>
          </div>
          <div className="p-5">
            <BloodWorkReport session={session} />
          </div>
        </div>
      </div>

      {/* Body analytics */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 shrink-0">Body analytics</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
          <div className="bg-violet-50 border-b border-violet-100 px-5 py-4">
            <div className="text-[11px] font-bold uppercase tracking-widest text-violet-400 mb-0.5">Overview</div>
            <h2 className="font-bold text-base text-violet-900">Body summary</h2>
          </div>
          <div className="p-5">
            <BodySummary body={body} />
          </div>
        </div>

        <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-6 space-y-5 lg:space-y-0">
          <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
            <div className="bg-indigo-50 border-b border-indigo-100 px-5 py-4">
              <div className="text-[11px] font-bold uppercase tracking-widest text-indigo-600 mb-0.5">Progress</div>
              <h2 className="font-bold text-base text-indigo-900">Weight chart</h2>
            </div>
            <div className="p-5">
              <WeightChart weights={body.weights} />
            </div>
          </div>
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
              <div className="bg-emerald-50 border-b border-emerald-100 px-5 py-4">
                <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-500 mb-0.5">Averages</div>
                <h2 className="font-bold text-base text-emerald-900">Weekly averages</h2>
              </div>
              <div className="p-5">
                <WeeklyAverages weights={body.weights} />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
              <div className="bg-amber-50 border-b border-amber-100 px-5 py-4">
                <div className="text-[11px] font-bold uppercase tracking-widest text-amber-500 mb-0.5">Estimate</div>
                <h2 className="font-bold text-base text-amber-900">Body fat</h2>
              </div>
              <div className="p-5">
                <BodyFatEstimate body={body} onChange={onBodyChange} />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
          <div className="bg-emerald-50 border-b border-emerald-100 px-5 py-4">
            <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-500 mb-0.5">Trends</div>
            <h2 className="font-bold text-base text-emerald-900">Measurements</h2>
          </div>
          <div className="p-5">
            <MeasurementsReport measurements={body.measurements} customFields={body.customFields} unit={body.unit} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
          <div className="bg-slate-50 border-b border-slate-100 px-5 py-4">
            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Logged entries</div>
            <h2 className="font-bold text-base text-slate-900">Measurement log</h2>
            <p className="text-xs text-slate-500 mt-0.5">Edit or delete a past entry if you logged something by mistake.</p>
          </div>
          <div className="p-5">
            <MeasurementHistory
              measurements={body.measurements}
              customFields={body.customFields}
              unit={body.unit}
              onChange={measurements => onBodyChange({ measurements })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
