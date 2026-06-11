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

export function BodyFatEstimate({ body, onChange, compact = false }) {
  const profile = body?.profile || {};
  const latestWeight = body?.weights?.at(-1);
  const latestMeasurement = body?.measurements?.at(-1);

  const waistCm = latestMeasurement?.waist || null;

  const estimate = estimateBodyFat({
    weightKg: latestWeight?.kg,
    waistCm,
    neckCm: Number(profile.neckCm),
    heightCm: Number(profile.heightCm)
  });

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

        {estimate === null ? (
          <p className="text-sm text-slate-500">
            Add height, neck, latest waist measurement, and latest weight to estimate body fat.
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