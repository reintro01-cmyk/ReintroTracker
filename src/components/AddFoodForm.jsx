import { useState } from "react";
import { Button } from "./ui.jsx";

const INPUT_BASE =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm " +
  "transition-shadow duration-150 " +
  "focus:outline-none focus:border-indigo-400 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.30)]";

export function AddFoodForm({ onAddFood, groupColors }) {
  const [name, setName] = useState("");
  const [group, setGroup] = useState("Dairy");
  const [portion, setPortion] = useState("");

  function submit(e) {
    e.preventDefault();
    if (!name.trim() || !group.trim()) return;

    onAddFood({
      name: name.trim(),
      group: group.trim(),
      portion: portion.trim() || "User-defined portion"
    });

    setName("");
    setGroup("Dairy");
    setPortion("");
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
    >
      <div className="text-sm font-bold text-slate-700 mb-3">Add new food</div>
      <div className="grid md:grid-cols-[1fr_220px_1fr_auto] gap-3 items-end">
        <label className="text-xs font-medium text-slate-600">
          Food name
          <input
            className={INPUT_BASE}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g., Ragi dosa"
          />
        </label>

        <label className="text-xs font-medium text-slate-600">
          Category
          <select
            className={INPUT_BASE}
            value={group}
            onChange={e => setGroup(e.target.value)}
          >
            {Object.keys(groupColors).map(g => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-medium text-slate-600">
          Portion
          <input
            className={INPUT_BASE}
            value={portion}
            onChange={e => setPortion(e.target.value)}
            placeholder="e.g., 1 small serving"
          />
        </label>

        <Button type="submit">Add food</Button>
      </div>
    </form>
  );
}
