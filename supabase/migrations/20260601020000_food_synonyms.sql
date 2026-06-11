-- Indian / colloquial food-name synonyms. The corpus stores foods under English/scientific
-- names ("Spinach", "Okra", "Yogurt"), so searches for the Hindi/Indian-English term ("palak",
-- "bhindi", "dahi", "curd") returned nothing. search_foods v4 expands the query through this
-- table before matching, so the existing ranking surfaces the right whole food.

create table if not exists food_synonyms (
  alias text primary key,
  canonical text not null
);

insert into food_synonyms (alias, canonical) values
  ('palak','spinach'), ('dahi','yogurt'), ('curd','yogurt'), ('bhindi','okra'),
  ('baingan','brinjal'), ('aloo','potato'), ('alu','potato'), ('gobi','cauliflower'),
  ('phoolgobi','cauliflower'), ('patta gobi','cabbage'), ('pyaz','onion'), ('pyaaz','onion'),
  ('jeera','cumin'), ('haldi','turmeric'), ('methi','fenugreek'), ('dhania','coriander'),
  ('karela','bitter gourd'), ('lauki','bottle gourd'), ('ghiya','bottle gourd'),
  ('tinda','gourd'), ('arbi','colocasia'), ('kaddu','pumpkin'), ('gajar','carrot'),
  ('matar','peas'), ('mutter','peas'), ('tamatar','tomato'), ('kheera','cucumber'),
  ('adrak','ginger'), ('lehsun','garlic'), ('mirch','chilli'), ('shimla mirch','capsicum'),
  ('makki','maize'), ('makka','maize'), ('chawal','rice'), ('doodh','milk'),
  ('makkhan','butter'), ('paneer','paneer'), ('moong','green gram'), ('chana','bengal gram'),
  ('kabuli chana','chickpea'), ('rajma','kidney beans'), ('toor','red gram'),
  ('arhar','red gram'), ('masoor','lentil'), ('urad','black gram'), ('lobia','cowpea'),
  ('besan','bengal gram'), ('atta','wheat flour'), ('maida','refined wheat flour'),
  ('sooji','semolina'), ('rava','semolina'), ('poha','rice flakes'), ('jowar','sorghum'),
  ('bajra','pearl millet'), ('ragi','finger millet'), ('nimbu','lemon'), ('anar','pomegranate'),
  ('seb','apple'), ('kela','banana'), ('aam','mango'), ('nariyal','coconut'),
  ('narial','coconut'), ('imli','tamarind'), ('gud','jaggery'), ('gur','jaggery'),
  ('namak','salt'), ('badam','almond'), ('kaju','cashew'), ('akhrot','walnut'),
  ('pista','pistachio'), ('kishmish','raisin'), ('anjeer','fig'), ('khajoor','dates'),
  ('saunf','fennel'), ('elaichi','cardamom'), ('dalchini','cinnamon'), ('laung','clove'),
  ('til','sesame'), ('sarson','mustard'), ('saag','spinach')
on conflict (alias) do update set canonical = excluded.canonical;

grant select on food_synonyms to anon, authenticated;
