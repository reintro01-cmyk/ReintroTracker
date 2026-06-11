export const SLOT_COLORS = {
  amber:   { badge: "bg-amber-500",   card: "border-amber-200 bg-amber-50",   text: "text-amber-700",   light: "bg-amber-100"   },
  orange:  { badge: "bg-orange-500",  card: "border-orange-200 bg-orange-50", text: "text-orange-700",  light: "bg-orange-100"  },
  emerald: { badge: "bg-emerald-500", card: "border-emerald-200 bg-emerald-50", text: "text-emerald-700", light: "bg-emerald-100" },
  teal:    { badge: "bg-teal-500",    card: "border-teal-200 bg-teal-50",     text: "text-teal-700",    light: "bg-teal-100"    },
  rose:    { badge: "bg-rose-500",    card: "border-rose-200 bg-rose-50",     text: "text-rose-700",    light: "bg-rose-100"    },
};

// slot type -> palette key, for rendering a recipe outside its planner slot
export const SLOT_TYPE_COLOR = {
  fat: "amber", protein: "orange", vegcarb: "emerald", fibre: "teal", proteincarb: "teal",
};
