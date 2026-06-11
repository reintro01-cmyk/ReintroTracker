import { useState, useMemo } from "react";
import { DEFAULT_FOODS } from "../data/foods.js";
import { GROUP_COLORS, GROUP_DOT_COLORS } from "../utils/groupColors.js";
import { parseGroupOrder } from "../utils/scheduleOrder.js";
import { parseGroupOrderWithAI } from "../utils/scheduleAI.js";
import { displayDate } from "../utils/dates.js";
import { StatusBadge } from "./StatusBadge.jsx";
import { AddFoodForm } from "./AddFoodForm.jsx";
import { Button } from "./ui.jsx";
import {
  Search, Wand2, RotateCcw, Loader2, ChevronUp, ChevronDown, ChevronRight,
  Trash2, Star, ShieldAlert, Plus, X, GripVertical,
} from "lucide-react";

// Common allergen quick-picks — ids resolved against the live food list; unknown ids drop silently.
const ALLERGEN_PRESETS = [
  { label: "Fish", ids: ["fish", "salmon", "tuna"] },
  { label: "Shellfish", ids: ["prawns", "crab"] },
  { label: "Peanuts", ids: ["peanuts"] },
  { label: "Tree nuts", ids: ["almonds", "cashews", "walnuts", "pistachios"] },
  { label: "Dairy", ids: ["milk", "curd", "cheese", "paneer", "buttermilk", "greek-yogurt", "cream-malai", "cheddar", "parmesan", "feta", "mozzarella", "gouda", "ricotta", "cottage-cheese", "swiss-cheese"] },
  { label: "Eggs", ids: ["eggs"] },
  { label: "Soy", ids: ["soy-sauce", "soya-chunks"] },
  { label: "Sesame", ids: ["sesame-seeds"] },
];

const STATUS_FILTERS = ["All", "Pending", "Safe", "Limit"];

// Unique groups in current foods order — reflects what the schedule shows top-to-bottom.
function groupsInOrder(foods) {
  const seen = new Set();
  const out = [];
  for (const f of foods) if (!seen.has(f.group)) { seen.add(f.group); out.push(f.group); }
  return out;
}

// ── Reorder by group: drag-free up/down on the group blocks + natural-language bar ──
function ReorderPanel({ foods, isCustom, onReorderGroups, onResetOrder }) {
  const groups = useMemo(() => groupsInOrder(foods), [foods]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const orderPreview = groups.slice(0, 4).join(" → ") + (groups.length > 4 ? " → …" : "");

  function moveGroup(i, dir) {
    const next = [...groups];
    const j = dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onReorderGroups(next);
  }

  async function applyOrder() {
    const text = input.trim();
    if (!text || thinking) return;
    setError("");
    const { order, recognized } = parseGroupOrder(text, groups);
    if (recognized > 0) { onReorderGroups(order); setInput(""); return; }
    setThinking(true);
    try {
      const aiOrder = await parseGroupOrderWithAI(text, groups);
      onReorderGroups(aiOrder);
      setInput("");
    } catch {
      setError('Couldn\'t parse that. Try naming groups — e.g. "dairy first, fruits last".');
    } finally {
      setThinking(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="w-full flex items-center gap-2 text-left">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 shrink-0">
          <Wand2 size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-800">Reintroduction order</h3>
          <p className="text-xs text-slate-500 truncate">
            {open ? "Move whole groups — foods inside keep their order. Or type it in plain English." : orderPreview}
          </p>
        </div>
        <ChevronRight size={16} className={`text-slate-400 transition-transform shrink-0 ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <>
          {isCustom && (
            <div className="flex justify-end -mb-1">
              <button onClick={onResetOrder}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-700">
                <RotateCcw size={11} /> Reset
              </button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text" value={input}
              onChange={e => { setInput(e.target.value); setError(""); }}
              onKeyDown={e => { if (e.key === "Enter") applyOrder(); }}
              placeholder='e.g. "move fruits to the end"'
          aria-label="Reorder food groups in plain English"
              className="flex-1 rounded-xl border-2 border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 transition-colors"
            />
            <Button onClick={applyOrder} disabled={!input.trim() || thinking} className="gap-1.5 shrink-0">
              {thinking ? <><Loader2 size={14} className="animate-spin" /> Thinking…</> : <><Wand2 size={14} /> Apply</>}
            </Button>
          </div>
          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

          <div className="flex flex-wrap gap-1.5">
            {groups.map((g, i) => (
              <span key={g} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-full pl-2 pr-1 py-0.5">
                <span className="text-[10px] font-bold text-slate-500 tabular-nums">{i + 1}</span>
                <span className={`w-2 h-2 rounded-full ${GROUP_DOT_COLORS[g] || "bg-slate-300"}`} />
                <span className="truncate max-w-[120px]">{g}</span>
                <span className="flex">
                  <button disabled={i === 0} onClick={() => moveGroup(i, "up")} aria-label={`Move ${g} earlier`}
                    className="p-1.5 rounded text-slate-500 hover:text-slate-700 disabled:opacity-20"><ChevronUp size={13} /></button>
                  <button disabled={i === groups.length - 1} onClick={() => moveGroup(i, "down")} aria-label={`Move ${g} later`}
                    className="p-1.5 rounded text-slate-500 hover:text-slate-700 disabled:opacity-20"><ChevronDown size={13} /></button>
                </span>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Allergies editor: preset chips + search-to-add + removable current chips ──
function AllergyEditor({ foods, allergies, onUpdate }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const allFoods = useMemo(() => {
    const map = new Map();
    for (const f of [...DEFAULT_FOODS, ...foods]) map.set(f.id, f);
    return [...map.values()];
  }, [foods]);
  const byId = useMemo(() => Object.fromEntries(allFoods.map(f => [f.id, f])), [allFoods]);
  const ids = new Set(allFoods.map(f => f.id));
  const sel = new Set(allergies);

  const toggle = id => onUpdate(sel.has(id) ? allergies.filter(x => x !== id) : [...allergies, id]);
  const toggleMany = list => {
    const valid = list.filter(id => ids.has(id));
    const allOn = valid.length > 0 && valid.every(id => sel.has(id));
    onUpdate(allOn ? allergies.filter(id => !valid.includes(id)) : [...new Set([...allergies, ...valid])]);
  };
  const presetOn = list => { const v = list.filter(id => ids.has(id)); return v.length > 0 && v.every(id => sel.has(id)); };

  const matches = search
    ? allFoods.filter(f => f.name.toLowerCase().includes(search.toLowerCase()) && !sel.has(f.id)).slice(0, 6)
    : [];

  return (
    <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4 space-y-3">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="w-full flex items-center gap-2 text-left">
        <ShieldAlert size={16} className="text-rose-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-rose-900 flex items-center gap-2">
            Allergies &amp; foods to avoid
            {allergies.length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700">{allergies.length}</span>
            )}
          </h3>
          <p className="text-xs text-rose-700/70 truncate">
            {open
              ? "Never scheduled, never suggested in recipes. Editable anytime."
              : allergies.length
                ? `${allergies.slice(0, 3).map(id => byId[id]?.name || id).join(", ")}${allergies.length > 3 ? ` +${allergies.length - 3} more` : ""}`
                : "None set — tap to add"}
          </p>
        </div>
        <ChevronRight size={16} className={`text-rose-300 transition-transform shrink-0 ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {ALLERGEN_PRESETS.filter(p => p.ids.some(id => ids.has(id))).map(p => {
              const on = presetOn(p.ids);
              return (
                <button key={p.label} type="button" onClick={() => toggleMany(p.ids)} aria-pressed={on}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-all ${
                    on ? "border-rose-400 bg-rose-100 text-rose-800" : "border-slate-200 bg-white text-slate-600 hover:border-rose-300"
                  }`}>
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Add another food to avoid…"
          aria-label="Add another food to avoid"
              className="w-full rounded-xl border-2 border-slate-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-rose-300"
            />
            {matches.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                {matches.map(f => (
                  <button key={f.id} type="button" onClick={() => { toggle(f.id); setSearch(""); }}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-rose-50 text-left">
                    <span className="text-slate-800">{f.name}</span>
                    <Plus size={14} className="text-rose-400" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {allergies.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {allergies.map(id => (
                <span key={id} className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-white border border-rose-300 text-rose-700">
                  {byId[id]?.name || id}
                  <button type="button" onClick={() => toggle(id)} aria-label={`Remove ${byId[id]?.name || id} from allergies`}
                    className="text-rose-400 hover:text-rose-700"><X size={12} /></button>
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FoodRow({ food, index, status, date, isFav, canUp, canDown, onUp, onDown, onToggleFav, onRemove, onOpen, onDragStart, onDragOver, onDrop }) {
  const justCleared = false;
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className="group grid grid-cols-[auto_1fr_auto] gap-2 items-center bg-white border border-slate-100 rounded-xl px-2.5 py-2 hover:border-slate-300 hover:bg-slate-50 transition-all"
    >
      <div className="flex items-center text-slate-300">
        <GripVertical size={15} className="cursor-grab active:cursor-grabbing group-hover:text-slate-400" />
      </div>
      <button type="button" onClick={onOpen} className="min-w-0 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
        <div className="font-semibold text-sm flex flex-wrap items-center gap-2">
          {index != null && <span className="text-slate-300 text-xs font-mono tabular-nums">{String(index).padStart(2, "0")}</span>}
          <span className="text-slate-800">{food.name}</span>
          <StatusBadge status={status} />
          {isFav && <Star size={11} className="text-amber-500 fill-amber-500" />}
        </div>
        <div className="text-xs text-slate-500 mt-0.5 truncate">
          {food.group}{date ? ` · ${displayDate(date)}` : ""}
        </div>
      </button>
      <div className="flex items-center gap-0.5 shrink-0">
        <div className="flex flex-col">
          <button disabled={!canUp} onClick={onUp} aria-label={`Move ${food.name} up`}
            className="p-1.5 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20"><ChevronUp size={13} /></button>
          <button disabled={!canDown} onClick={onDown} aria-label={`Move ${food.name} down`}
            className="p-1.5 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20"><ChevronDown size={13} /></button>
        </div>
        <button type="button" onClick={onToggleFav} aria-pressed={isFav}
          title={isFav ? "Unfavourite" : "Favourite — boost in recipe suggestions"}
          className={`p-1.5 rounded-lg transition-colors ${isFav ? "text-amber-500 bg-amber-50 hover:bg-amber-100" : "text-slate-300 hover:text-amber-500 hover:bg-amber-50"}`}>
          <Star size={13} fill={isFav ? "currentColor" : "none"} />
        </button>
        <Button variant="ghost" size="sm" onClick={onRemove} className="text-rose-400 hover:bg-rose-50" aria-label={`Remove ${food.name}`}>
          <Trash2 size={13} />
        </Button>
      </div>
    </div>
  );
}

export function FoodManager({
  foods, removed, status, allergies = [], favouriteFoods = [],
  reintroStart, schedule = [], introOrder, preferredGroups,
  onAddFood, onRemoveFood, onRestoreFood, onMoveFood,
  onReorderGroups, onResetOrder, onUpdateAllergies, onToggleFav, onSelect,
}) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);
  const [dragId, setDragId] = useState(null);

  const allergySet = useMemo(() => new Set(allergies), [allergies]);
  const st = id => status[id] || "Pending";
  const isExcluded = f => allergySet.has(f.id) || st(f.id) === "Avoid";

  // Introduce date + sequence number per food, straight from the computed schedule
  // (honours pins + exclusions), so the numbers/dates match the calendar exactly.
  const introInfo = useMemo(() => {
    const out = {};
    let n = 0;
    for (const s of schedule) {
      if (s.type !== "Introduce") continue;
      n += 1;
      out[s.food.id] = { date: s.date, seq: n };
    }
    return out;
  }, [schedule]);

  const counts = useMemo(() => {
    const c = { Safe: 0, Limit: 0, Avoid: 0, Pending: 0 };
    for (const f of foods) c[st(f.id)] = (c[st(f.id)] || 0) + 1;
    return c;
  }, [foods, status]);

  const groups = useMemo(() => groupsInOrder(foods), [foods]);
  const isCustom = introOrder === "group" && Array.isArray(preferredGroups) && preferredGroups.length > 0;
  const query = q.trim().toLowerCase();

  // Active reorderable list, grouped. Excluded (allergy/Avoid) foods are pulled out below.
  const grouped = useMemo(() => {
    const active = foods.filter(f => !isExcluded(f));
    const visible = active.filter(f => {
      if (query && !f.name.toLowerCase().includes(query)) return false;
      if (statusFilter !== "All" && st(f.id) !== statusFilter) return false;
      return true;
    });
    return groups
      .map(g => ({ group: g, items: visible.filter(f => f.group === g) }))
      .filter(g => g.items.length > 0);
  }, [foods, groups, query, statusFilter, allergySet, status]);

  const excludedFoods = foods.filter(isExcluded);
  const totalVisible = grouped.reduce((n, g) => n + g.items.length, 0);

  function openStatus(food) {
    const observe = schedule.find(s => s.food.id === food.id && s.type === "Observe");
    onSelect(observe || { food, type: "Observe", date: introInfo[food.id]?.date || reintroStart });
  }

  function onDropRow(targetFood) {
    if (!dragId || dragId === targetFood.id) return;
    const dragged = foods.find(f => f.id === dragId);
    if (dragged && dragged.group === targetFood.group) onMoveFood(dragId, targetFood.id);
    setDragId(null);
  }

  const toggleCollapse = g => setCollapsed(prev => {
    const next = new Set(prev);
    next.has(g) ? next.delete(g) : next.add(g);
    return next;
  });

  return (
    <div className="space-y-4">
      {/* Status summary */}
      <div className="flex flex-wrap gap-2">
        {[
          { k: "Safe", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
          { k: "Limit", cls: "bg-amber-50 text-amber-700 border-amber-200" },
          { k: "Pending", cls: "bg-slate-50 text-slate-600 border-slate-200" },
          { k: "Avoid", cls: "bg-rose-50 text-rose-700 border-rose-200" },
        ].map(({ k, cls }) => (
          <div key={k} className={`rounded-xl border px-3 py-1.5 text-sm font-bold ${cls}`}>
            <span className="text-xs font-semibold opacity-60 mr-1.5">{k}</span>{counts[k] || 0}
          </div>
        ))}
      </div>

      <ReorderPanel foods={foods} isCustom={isCustom} onReorderGroups={onReorderGroups} onResetOrder={onResetOrder} />

      <AllergyEditor foods={foods} allergies={allergies} onUpdate={onUpdateAllergies} />

      {/* Search + status filter + add */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search foods…"
            aria-label="Search foods"
            className="w-full rounded-xl border-2 border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
          />
        </div>
        <div className="flex gap-0.5 bg-slate-100 rounded-lg p-0.5" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} aria-pressed={statusFilter === s}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                statusFilter === s ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}>
              {s}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowAdd(v => !v)} className="gap-1.5">
          <Plus size={13} /> Add food
        </Button>
      </div>

      {showAdd && <AddFoodForm onAddFood={f => { onAddFood(f); setShowAdd(false); }} groupColors={GROUP_COLORS} />}

      {/* Grouped, reorderable food list */}
      {totalVisible === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center">
          <p className="text-sm font-semibold text-slate-500">No foods match.</p>
          <p className="text-xs text-slate-500 mt-1">{query || statusFilter !== "All" ? "Try a different search or filter." : "Add a food to get started."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(({ group, items }) => {
            const isOpen = !collapsed.has(group);
            return (
              <div key={group} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <button onClick={() => toggleCollapse(group)} aria-expanded={isOpen}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 border-b ${GROUP_COLORS[group] || "bg-slate-50 border-slate-200"}`}>
                  <ChevronRight size={15} className={`text-slate-500 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                  <span className={`w-2.5 h-2.5 rounded-full ${GROUP_DOT_COLORS[group] || "bg-slate-300"}`} />
                  <span className="font-bold text-sm text-slate-800">{group}</span>
                  <span className="text-xs font-semibold text-slate-500">{items.length}</span>
                </button>
                {isOpen && (
                  <div className="p-2 space-y-1.5">
                    {items.map((food, i) => (
                      <FoodRow
                        key={food.id}
                        food={food}
                        index={introInfo[food.id]?.seq}
                        date={introInfo[food.id]?.date}
                        status={st(food.id)}
                        isFav={favouriteFoods.includes(food.id)}
                        canUp={i > 0}
                        canDown={i < items.length - 1}
                        onUp={() => onMoveFood(food.id, items[i - 1].id)}
                        onDown={() => onMoveFood(items[i + 1].id, food.id)}
                        onToggleFav={() => onToggleFav(food.id)}
                        onRemove={() => onRemoveFood(food.id)}
                        onOpen={() => openStatus(food)}
                        onDragStart={() => setDragId(food.id)}
                        onDragOver={e => e.preventDefault()}
                        onDrop={() => onDropRow(food)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Excluded: allergies + Avoid verdicts + removed */}
      {(excludedFoods.length > 0 || removed.length > 0) && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <button onClick={() => setShowExcluded(v => !v)} aria-expanded={showExcluded}
            className="w-full flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
            <ChevronRight size={15} className={`text-slate-500 transition-transform ${showExcluded ? "rotate-90" : ""}`} />
            <span className="font-bold text-sm text-slate-700">Excluded &amp; removed</span>
            <span className="text-xs font-semibold text-slate-500">{excludedFoods.length + removed.length}</span>
          </button>
          {showExcluded && (
            <div className="p-4 space-y-4">
              {excludedFoods.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">Not being reintroduced</p>
                  <div className="flex flex-wrap gap-2">
                    {excludedFoods.map(f => (
                      <button key={f.id} onClick={() => openStatus(f)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-600 hover:border-slate-300">
                        {allergySet.has(f.id) && <ShieldAlert size={11} className="text-rose-500" />}
                        {f.name}
                        <span className="text-[10px] text-slate-500">{allergySet.has(f.id) ? "allergy" : "avoid"}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {removed.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">Removed — tap to restore</p>
                  <div className="flex flex-wrap gap-2">
                    {removed.map(f => (
                      <button key={f.id} onClick={() => onRestoreFood(f.id)}
                        className="text-sm px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-all">
                        + {f.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-rose-100 bg-rose-50 p-4">
        <p className="font-semibold text-xs uppercase tracking-wide text-rose-500 mb-1">Always excluded</p>
        <p className="text-xs text-rose-700 leading-relaxed">Fish, prawns, crab, squid, shellfish, fish sauce, shrimp paste, oyster sauce, seafood stock, Worcestershire sauce unless verified fish-free.</p>
      </div>
    </div>
  );
}
