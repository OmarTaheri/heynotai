/// <reference path="../pb_data/types.d.ts" />
/* Add `aiPct` to the `scans` collection — a unified 0..100 AI-generated
 * probability persisted by the api (`run-detection.ts`) so the client
 * never has to derive it from verdict+confidence on its own. */
migrate(
  (app) => {
    const c = app.findCollectionByNameOrId("scans");
    if (!c.fields.find((f) => f.name === "aiPct")) {
      c.fields.add(new NumberField({ name: "aiPct", min: 0, max: 100 }));
    }
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId("scans");
    c.fields.removeByName("aiPct");
    app.save(c);
  },
);
