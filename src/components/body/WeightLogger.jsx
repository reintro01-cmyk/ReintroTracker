import { useState } from "react";
import { Card, CardContent, Button } from "../ui.jsx";
import { todayIso as today } from "../../utils/dates.js";

export function WeightLogger({ weights, onChange }) {
  const [error, setError] = useState("");

  function logWeight(e) {
    e.preventDefault();

    const form = new FormData(e.currentTarget);
    const date = form.get("date");
    const kg = Number(form.get("kg"));

    if (!date || Number.isNaN(kg)) return;

    if (date > today()) {
      setError("You can't log weight for a future date.");
      return;
    }
    setError("");

    const nextWeights = weights
      .filter(item => item.date !== date)
      .concat({ date, kg })
      .sort((a, b) => a.date.localeCompare(b.date));

    onChange(nextWeights);
    e.currentTarget.reset();
  }

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-5">
        <h2 className="font-semibold text-lg mb-3">Log weight</h2>

        <form
          onSubmit={logWeight}
          className="grid md:grid-cols-[1fr_1fr_auto] gap-3 items-end"
        >
          <label className="text-sm font-medium">
            Date
            <input
              name="date"
              type="date"
              defaultValue={today()}
              max={today()}
              onChange={() => error && setError("")}
              className="mt-1 w-full rounded-md border p-2"
            />
          </label>

          <label className="text-sm font-medium">
            Weight kg
            <input
              name="kg"
              type="number"
              step="0.1"
              placeholder="e.g., 130.0"
              className="mt-1 w-full rounded-md border p-2"
            />
          </label>

          <Button type="submit">Log weight</Button>
        </form>
        {error && <p className="text-xs text-rose-600 mt-2">{error}</p>}
      </CardContent>
    </Card>
  );
}
