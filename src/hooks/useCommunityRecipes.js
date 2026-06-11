import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

// Cross-user "dynamic recipe" list: dishes that >= minUsers distinct users have logged, with
// median macros. Read-only, powered by the get_community_recipes SECURITY DEFINER RPC (raw
// community_entries rows are never client-readable). Maps rows to the card shape used on the
// recipes page.
export function useCommunityRecipes(minUsers = 3) {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true); setError("");
    const { data, error: e } = await supabase.rpc("get_community_recipes", { min_users: minUsers });
    if (e) { setError(e.message); setRecipes([]); }
    else {
      setRecipes((data || []).map(r => ({
        id: `comm-${r.signature}`,
        name: r.name,
        users: Number(r.users) || 0,
        kcal: Math.round(Number(r.kcal) || 0),
        macros: {
          protein: Math.round(Number(r.protein_g) || 0),
          fat:     Math.round(Number(r.fat_g) || 0),
          carbs:   Math.round(Number(r.carb_g) || 0),
          fibre:   Math.round(Number(r.fibre_g) || 0),
        },
        source: "COMMUNITY",
      })));
    }
    setLoading(false);
  }, [minUsers]);

  useEffect(() => { reload(); }, [reload]);

  return { recipes, loading, error, reload };
}
