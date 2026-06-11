import { Card, CardContent } from "../ui.jsx";

function getWeekKey(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  const firstDay = new Date(date.getFullYear(), 0, 1);

  const days = Math.floor(
    (date - firstDay) / (24 * 60 * 60 * 1000)
  );

  const week = Math.ceil((days + firstDay.getDay() + 1) / 7);

  return `${date.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function WeeklyAverages({ weights, compact = false }) {
  const grouped = {};

  weights.forEach(entry => {
    const week = getWeekKey(entry.date);

    if (!grouped[week]) {
      grouped[week] = [];
    }

    grouped[week].push(entry.kg);
  });

  const rows = Object.entries(grouped).map(([week, values]) => {
    const average =
      values.reduce((a, b) => a + b, 0) / values.length;

    return { week, average };
  });

  const rowsWithChange = rows.map((row, index) => {
    const previous = rows[index - 1];

    return {
      ...row,
      change:
        previous ? row.average - previous.average : null
    };
  });

  return (
    <Card className="rounded-2xl">
      <CardContent className={compact ? "p-4" : "p-5"}>
        <h2 className={compact ? "font-semibold text-base mb-2" : "font-semibold text-lg mb-3"}>
  Weekly weight loss
</h2>

        {rowsWithChange.length === 0 ? (
          <p className="text-sm text-slate-500">
            No weight logs yet.
          </p>
        ) : (
          <div className="space-y-2">
            {rowsWithChange.map(row => (
              <div
                key={row.week}
                className="grid grid-cols-3 gap-3 border-b pb-2 text-sm"
              >
                <span>{row.week}</span>

                <span className="font-semibold">
                  {row.average.toFixed(1)} kg avg
                </span>

                <span
                  className={
                    row.change === null
                      ? "text-slate-500"
                      : row.change < 0
                      ? "text-green-700 font-semibold"
                      : "text-red-700 font-semibold"
                  }
                >
                  {row.change === null
                    ? "Baseline"
                    : `${row.change > 0 ? "+" : ""}${row.change.toFixed(1)} kg`}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}