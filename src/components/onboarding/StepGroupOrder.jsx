import { ChevronUp, ChevronDown } from "lucide-react";

export function StepGroupOrder({ groupOrder, moveGroup }) {
  return (
    <div className="space-y-4 animate-fadeUp">
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-1">Arrange food groups</h2>
        <p className="text-sm text-slate-500">Top group will be introduced first. Use arrows to reorder.</p>
      </div>
      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
        {groupOrder.map((group, i) => (
          <div key={group} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
            <span className="text-xs font-mono text-slate-500 w-5 shrink-0">{i + 1}</span>
            <span className="flex-1 text-sm font-medium text-slate-700 truncate">{group}</span>
            <div className="flex gap-0.5 shrink-0">
              <button disabled={i === 0} onClick={() => moveGroup(i, "up")}
                className="p-1 rounded text-slate-500 hover:text-slate-700 disabled:opacity-20 transition-colors">
                <ChevronUp size={14} />
              </button>
              <button disabled={i === groupOrder.length - 1} onClick={() => moveGroup(i, "down")}
                className="p-1 rounded text-slate-500 hover:text-slate-700 disabled:opacity-20 transition-colors">
                <ChevronDown size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
