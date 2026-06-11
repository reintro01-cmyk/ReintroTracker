// Lazy loader for the recipe corpus.
//
// The corpus (recipes.data.js, ~1MB) is dynamic-imported so Vite splits it into
// its own chunk and keeps the initial bundle small. main.jsx awaits loadRecipes()
// before rendering, so by the time any consumer calls getRecipes() the cache is
// populated and they can stay synchronous.

let _cache = null;
let _pending = null;

export function loadRecipes() {
  if (_cache) return Promise.resolve(_cache);
  if (!_pending) {
    _pending = import("./recipes.data.js").then(mod => {
      _cache = mod.RECIPES;
      return _cache;
    });
  }
  return _pending;
}

export function getRecipes() {
  if (!_cache) {
    throw new Error("Recipes not loaded. Call await loadRecipes() before reading the corpus.");
  }
  return _cache;
}
