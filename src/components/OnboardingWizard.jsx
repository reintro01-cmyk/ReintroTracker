import { useState } from "react";
import { Button } from "./ui.jsx";
import { DEFAULT_FOODS } from "../data/foods";
import { todayIso } from "../utils/dates.js";
import { StepStartDate } from "./onboarding/StepStartDate.jsx";
import { StepStrategy } from "./onboarding/StepStrategy.jsx";
import { StepGroupOrder } from "./onboarding/StepGroupOrder.jsx";
import { StepPriorityFoods } from "./onboarding/StepPriorityFoods.jsx";
import { StepAllergies } from "./onboarding/StepAllergies.jsx";
import { StepSummary } from "./onboarding/StepSummary.jsx";
import { ChevronRight, ChevronLeft, Sparkles, CheckCircle2, X } from "lucide-react";

const ALL_GROUPS = [...new Set(DEFAULT_FOODS.map(f => f.group))];

function StepDots({ current, total }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={`rounded-full transition-all duration-300 ${
          i + 1 === current ? "w-6 h-2.5 bg-indigo-600" : i + 1 < current ? "w-2.5 h-2.5 bg-indigo-300" : "w-2.5 h-2.5 bg-slate-200"
        }`} />
      ))}
    </div>
  );
}

export function OnboardingWizard({ onComplete }) {
  const today = todayIso();
  const [step, setStep] = useState(0);
  const [startDate, setStartDate] = useState(today);
  const [introOrder, setIntroOrder] = useState("standard");
  const [groupOrder, setGroupOrder] = useState([...ALL_GROUPS]);
  const [priorityFoods, setPriorityFoods] = useState([]);
  const [allergies, setAllergies] = useState([]);
  const [search, setSearch] = useState("");

  // Ordered step keys — derived from the chosen strategy, so there's no brittle index math.
  const steps = ["start", "strategy"];
  if (introOrder === "group") steps.push("groupOrder");
  else if (introOrder === "priority") steps.push("priorityFoods");
  steps.push("allergies", "summary");

  const safeStep = Math.min(step, steps.length - 1);
  const currentKey = steps[safeStep];
  const isLast = safeStep === steps.length - 1;
  const totalSteps = steps.length;
  const displayStep = safeStep + 1;

  const reintroDate = (() => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + 14);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  })();

  const filteredFoods = DEFAULT_FOODS.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

  function moveGroup(index, dir) {
    setGroupOrder(prev => {
      const next = [...prev];
      const j = dir === "up" ? index - 1 : index + 1;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }

  function togglePriorityFood(foodId) {
    setPriorityFoods(prev => prev.includes(foodId) ? prev.filter(id => id !== foodId) : [...prev, foodId]);
  }

  function nextStep() {
    setStep(s => Math.min(s + 1, steps.length - 1));
  }

  function prevStep() {
    setStep(s => Math.max(s - 1, 0));
  }

  function handleComplete() {
    onComplete({ programmeStart: startDate, introOrder, preferredGroups: groupOrder, priorityFoods, allergies, onboardingComplete: true });
  }

  function handleSkip() {
    onComplete({ programmeStart: today, introOrder: "standard", preferredGroups: [...ALL_GROUPS], priorityFoods: [], allergies: [], onboardingComplete: true });
  }

  return (
    <div className="fixed inset-0 z-50 bg-indigo-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-scaleIn">
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-500 px-7 pt-7 pb-5 text-white relative">
          <button onClick={handleSkip} aria-label="Close"
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-all">
            <X size={18} />
          </button>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={18} className="opacity-80" />
            <span className="text-xs font-bold uppercase tracking-widest opacity-70">Welcome to your programme</span>
          </div>
          <h1 className="text-2xl font-bold">Let's set you up</h1>
          <p className="text-sm text-indigo-200 mt-1">Takes about 2 minutes. You can always change these later.</p>
        </div>

        <div className="px-7 py-6">
          <StepDots current={displayStep} total={totalSteps} />

          {currentKey === "start"        && <StepStartDate startDate={startDate} setStartDate={setStartDate} reintroDate={reintroDate} />}
          {currentKey === "strategy"     && <StepStrategy introOrder={introOrder} setIntroOrder={setIntroOrder} />}
          {currentKey === "groupOrder"   && <StepGroupOrder groupOrder={groupOrder} moveGroup={moveGroup} />}
          {currentKey === "priorityFoods" && <StepPriorityFoods priorityFoods={priorityFoods} togglePriorityFood={togglePriorityFood} search={search} setSearch={setSearch} filteredFoods={filteredFoods} />}
          {currentKey === "allergies"    && <StepAllergies allergies={allergies} setAllergies={setAllergies} />}
          {currentKey === "summary"      && <StepSummary startDate={startDate} reintroDate={reintroDate} introOrder={introOrder} priorityFoods={priorityFoods} />}

          <div className="flex items-center justify-between mt-7 pt-5 border-t border-slate-100">
            {safeStep > 0
              ? <Button variant="outline" onClick={prevStep} className="gap-1.5"><ChevronLeft size={14} /> Back</Button>
              : <div />
            }
            {!isLast
              ? <Button onClick={nextStep} className="gap-1.5">Continue <ChevronRight size={14} /></Button>
              : <Button onClick={handleComplete} className="gap-1.5 bg-emerald-600 border-emerald-600 hover:bg-emerald-700"><CheckCircle2 size={15} /> Start my programme</Button>
            }
          </div>
        </div>
      </div>
    </div>
  );
}
