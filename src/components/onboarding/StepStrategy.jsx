import { CheckCircle2, ListOrdered, Layers, Target } from "lucide-react";

function StrategyCard({ icon, title, desc, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl border-2 p-4 transition-all duration-150 ${
        selected ? "border-indigo-500 bg-indigo-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${selected ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-500"}`}>
          {icon}
        </div>
        <div>
          <div className={`font-semibold text-sm ${selected ? "text-indigo-800" : "text-slate-800"}`}>{title}</div>
          <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</div>
        </div>
        {selected && <CheckCircle2 size={18} className="text-indigo-500 shrink-0 ml-auto mt-0.5" />}
      </div>
    </button>
  );
}

export function StepStrategy({ introOrder, setIntroOrder }) {
  return (
    <div className="space-y-4 animate-fadeUp">
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-1">How do you want to reintroduce foods?</h2>
        <p className="text-sm text-slate-500">This sets the order in which foods appear in your schedule.</p>
      </div>
      <div className="space-y-3">
        <StrategyCard icon={<ListOrdered size={18} />} title="Standard order"
          desc="Default sequence designed by your nutritionist. Easiest to follow."
          selected={introOrder === "standard"} onClick={() => setIntroOrder("standard")} />
        <StrategyCard icon={<Layers size={18} />} title="Group by group"
          desc="Finish all foods in one category before moving to the next. Clearer patterns."
          selected={introOrder === "group"} onClick={() => setIntroOrder("group")} />
        <StrategyCard icon={<Target size={18} />} title="Priority first"
          desc="Handpick the foods you miss the most. Test those first, then continue with the rest."
          selected={introOrder === "priority"} onClick={() => setIntroOrder("priority")} />
      </div>
    </div>
  );
}
