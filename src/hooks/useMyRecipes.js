import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

// Loads the recipes a user has created/imported (recipes.created_by = them), with each
// recipe's per-serving nutrition and ingredient count. Owner-RLS scopes it to the user.
export function useMyRecipes(session) {
  const userId = session?.user?.id || null;
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!userId) { setRecipes([]); return; }
    setLoading(true);
    const { data: recs } = await supabase
      .from("recipes")
      .select("id,name,servings,status,source_id,created_at")
      .eq("created_by", userId)
      .order("created_at", { ascending: false });
    const ids = (recs || []).map(r => r.id);
    const nutByRecipe = {}, ingCount = {};
    if (ids.length) {
      const [{ data: nut }, { data: ings }] = await Promise.all([
        supabase.from("recipe_nutrition").select("recipe_id,energy_kcal,protein_g,fat_g,carb_avail_g,fibre_g,flags").in("recipe_id", ids).eq("per", "serving"),
        supabase.from("recipe_ingredients").select("recipe_id").in("recipe_id", ids),
      ]);
      for (const n of nut || []) nutByRecipe[n.recipe_id] = n;
      for (const i of ings || []) ingCount[i.recipe_id] = (ingCount[i.recipe_id] || 0) + 1;
    }
    setRecipes((recs || []).map(r => ({ ...r, nutrition: nutByRecipe[r.id] || null, ingredientCount: ingCount[r.id] || 0 })));
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Detach any food_logs first (recipe_id FK is NO ACTION); ingredients + nutrition CASCADE.
  const remove = useCallback(async (id) => {
    await supabase.from("food_logs").update({ recipe_id: null }).eq("recipe_id", id);
    await supabase.from("recipes").delete().eq("id", id);
    await load();
  }, [load]);

  return { recipes, loading, reload: load, remove };
}
