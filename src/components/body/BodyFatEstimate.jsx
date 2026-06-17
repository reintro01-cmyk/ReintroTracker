import { Card, CardContent } from "../ui.jsx";

function estimateBodyFat({ weightKg, waistCm, neckCm, heightCm }) {
  if (!weightKg || !waistCm || !neckCm || !heightCm) return null;

  const waistIn = waistCm / 2.54;
  const neckIn = neckCm / 2.54;
  const heightIn = heightCm / 2.54;

  if (waistIn <= neckIn) return null;

  return (
    86.010 * Math.log10(waistIn - neckIn) -
    70.041 * Math.log10(heightIn) +
    36.76
  );
}

function computeBmi({ weightKg, heightCm }) {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  const bmi = weightKg / (m * m);
  return Number.isFinite(bmi) && bmi > 0 ? bmi : null;
}

// WHO adult BMI categories.
function bmiCategory(bmi) {
  if (bmi < 18.5) return { label: "Underweight", className: "text-amber-600" };
  if (bmi < 25)   return { label: "Normal",      className: "text-emerald-600" };
  if (bmi < 30)   return { label: "Overweight",  className: "text-amber-600" };
  return { label: "Obese", className: "text-rose-600" };
}

export function BodyFatEstimate({ body, onChange, compact = false }) {
  const profile = body?.profile || {};
  const latestWeight = body?.weights?.at(-1);
  const latestMeasurement = body?.measurements?.at(-1);

  const waistCm = latestMeasurement?.waist || null;
  const weightKg = latestWeight?.kg || null;
  const heightCm = Number(profile.heightCm) || null;

  const estimate = estimateBodyFat({
    weightKg,
    waistCm,
    neckCm: Number(profile.neckCm),
    heightCm
  });

  const bmi = computeBmi({ weightKg, heightCm });
  const cat = bmi !== null ? bmiCategory(bmi) : null;

  function updateProfile(key, value) {
    // Patch shape: parent's updateBody spreads this into body
    onChange?.({
      profile: {
        ...profile,
        [key]: value
      }
    });
  }

  return (
    <Card className="rounded-2xl">
     <CardContent className={compact ? "p-4" : "p-5"}>
        <h2 className={compact ? "font-semibold text-base" : "font-semibold text-lg"}>
  Body fat estimate
</h2>

        <div className="grid md:grid-cols-2 gap-3 mb-4">
          <label className="text-sm font-medium">
            Height cm
            <input
              type="number"
              min="1"
              step="0.1"
              className="mt-1 w-full rounded-md border p-2"
              value={profile.heightCm || ""}
              onChange={e => updateProfile("heightCm", e.target.value)}
              placeholder="e.g., 178"
            />
          </label>

          <label className="text-sm font-medium">
            Neck cm
            <input
              type="number"
              min="1"
              step="0.1"
              className="mt-1 w-full rounded-md border p-2"
              value={profile.neckCm || ""}
              onChange={e => updateProfile("neckCm", e.target.value)}
              placeholder="e.g., 42"
            />
          </label>
        </div>

        {/* BMI — needs only height + latest weight, so it appears as soon as those exist */}
        <div className="mb-4 pb-4 border-b border-slate-100">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">BMI</div>
          {bmi === null ? (
            <p className="text-sm text-slate-500">
              Enter your height above{weightKg ? "" : " and log a weight entry"} to see your BMI.
            </p>
          ) : (
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-semibold">{bmi.toFixed(1)}</div>
              <div className={`text-sm font-semibold ${cat.className}`}>{cat.label}</div>
              <div className="text-xs text-slate-400 ml-auto">
                {weightKg.toFixed(1)} kg · {heightCm} cm
              </div>
            </div>
          )}
        </div>

        {/* Body fat — additionally needs neck + a logged waist measurement */}
        <div className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">Body fat</div>
        {estimate === null ? (
          <p className="text-sm text-slate-500">
            {!waistCm
              ? "Log a waist measurement (plus neck and height above) to estimate body fat."
              : "Add height, neck, latest waist measurement, and latest weight to estimate body fat."}
          </p>
        ) : (
          <div>
            <div className="text-3xl font-semibold">
              {estimate.toFixed(1)}%
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Estimate based on waist, neck, height, and latest weight.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}