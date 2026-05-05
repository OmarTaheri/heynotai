/// <reference path="../pb_data/types.d.ts" />
/* Drop the unused `reduceMotion` field from `appearance_prefs`. The
 * setting was removed from onboarding and the appearance settings UI. */
migrate(
  (app) => {
    const c = app.findCollectionByNameOrId("appearance_prefs");
    if (c.fields.find((x) => x.name === "reduceMotion")) {
      c.fields.removeByName("reduceMotion");
      app.save(c);
    }
  },
  (app) => {
    const c = app.findCollectionByNameOrId("appearance_prefs");
    if (!c.fields.find((x) => x.name === "reduceMotion")) {
      c.fields.add(new BoolField({ name: "reduceMotion" }));
      app.save(c);
    }
  },
);
