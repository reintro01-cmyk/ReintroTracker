import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";

import { CollapsibleCard } from "../CollapsibleCard.jsx";

function formatChartDate(value) {
  const date = new Date(`${value}T00:00:00`);

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short"
  });
}

export function WeightChart({ weights }) {
  return (
    <CollapsibleCard title="Weight trend" defaultOpen>
      {weights.length < 2 ? (
        <p className="text-sm text-slate-500">
          Add at least two weight logs to see chart.
        </p>
      ) : (
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weights}>
              <CartesianGrid strokeDasharray="3 3" />

              <XAxis
                dataKey="date"
                tickFormatter={formatChartDate}
                angle={-20}
                textAnchor="end"
                height={50}
              />

              <YAxis domain={["dataMin - 2", "dataMax + 2"]} />

              <Tooltip
                labelFormatter={formatChartDate}
                formatter={value => [`${value} kg`, "Weight"]}
              />

              <Line
                type="monotone"
                dataKey="kg"
                strokeWidth={3}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </CollapsibleCard>
  );
}