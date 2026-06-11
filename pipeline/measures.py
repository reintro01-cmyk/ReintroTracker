"""Household-measure -> grams conversion + cooking-water/yield handling.

A first real `measures` layer: generic units, ingredient-class cup densities, curated
piece weights, and a dish-type cooking-water estimate (so soups/curries aren't
over-concentrated per 100g). Values are kitchen-reference approximations; per-ingredient
overrides from USDA food_portion.csv can refine these later.
"""

UNIT_G = {  # grams per unit (cup handled separately by density)
    "teaspoon": 5, "teaspoons": 5, "tsp": 5, "tablespoon": 15, "tablespoons": 15, "tbsp": 15,
    "gram": 1, "grams": 1, "g": 1, "kg": 1000, "ml": 1, "litre": 1000, "litres": 1000, "l": 1000,
    "inch": 6, "cm": 3, "clove": 3, "cloves": 3, "pinch": 0.3, "sprig": 1, "sprigs": 1,
    "glass": 240, "bowl": 150, "handful": 20,
}

# (keywords, grams per cup) — first match wins
CUP_DENSITY = [
    (("leaves", "spinach", "coriander", "methi", "greens", "fenugreek"), 30),
    (("flour", "besan", "atta", "maida", "rava", "sooji", "semolina"), 120),
    (("milk", "water", "oil", "curd", "yogurt", "stock", "broth", "buttermilk", "cream"), 240),
    (("sugar", "jaggery"), 200),
    (("dal", "rice", "gram", "lentil", "grain", "quinoa", "poha", "millet"), 180),
    (("cashew", "almond", "nut", "peanut", "seeds"), 140),
    (("paneer", "grated", "chopped", "cubed"), 160),
]

PIECE_WEIGHTS = {  # grams per single piece (count-only quantities)
    "onion": 110, "tomato": 80, "potato": 120, "egg": 50, "green chilli": 5, "green chillies": 5,
    "chilli": 5, "chillies": 5, "lemon": 60, "lime": 45, "banana": 100, "garlic": 3, "clove": 3,
    "capsicum": 120, "bell pepper": 120, "carrot": 60, "cucumber": 200, "bread": 28, "slice": 28,
    "bay leaf": 0.2, "bay leaves": 0.2, "cardamom": 0.5, "curry leaves": 0.5, "ginger": 15,
}  # piece weights confirmed against USDA SR food_portion.csv (egg 50, onion 110, bread slice 28)

# dish-type -> added cooking/serving water as a multiple of summed solid weight
# (ordered; first keyword match wins — most-diluted categories first)
WATER_RULES = [
    (("tea", "coffee", "lassi", "juice", "sherbet", "sharbat", "shake", "smoothie",
      "chaas", "lemonade", "cooler", "mojito", "buttermilk", "kanji", "aam panna"), 8.0),
    (("soup", "rasam", "broth", "shorba", "stock", "consomme", "saar"), 3.0),
    (("curry", "gravy", "korma", "kuzhambu", "sambar", " dal", "kadhi", "saaru", "kootu", "stew"), 1.0),
    (("rice", "pulao", "pulav", "biryani", "khichdi", "pongal"), 0.8),
    (("idli", "dosa", "appam", "puttu", "porridge", "kheer", "payasam"), 0.5),
]


def grams_of(qty, unit, name):
    nm = (name or "").lower()
    if qty is None:
        return 20.0                                    # "to taste"/unspecified small default
    u = (unit or "").lower()
    if u == "cup" or u == "cups":
        for kws, g in CUP_DENSITY:
            if any(w in nm for w in kws):
                return qty * g
        return qty * 150
    if u in UNIT_G:
        if u in ("inch", "cm") and "ginger" not in nm:
            return qty * UNIT_G[u]
        return qty * UNIT_G[u]
    for w, g in sorted(PIECE_WEIGHTS.items(), key=lambda x: -len(x[0])):
        if w in nm:
            return qty * g
    return qty * 40.0                                  # generic piece


def added_water_g(dish_name, solid_g):
    nm = (dish_name or "").lower()
    for kws, mult in WATER_RULES:
        if any(w in nm for w in kws):
            return solid_g * mult
    return 0.0
