/// <reference path="../pb_data/types.d.ts" />
/* Add `engineResults` to the `scans` collection — a JSON map keyed by
 * engine slug. Every successful detection (`api/src/lib/run-detection.ts`)
 * writes its verdict into this map alongside the top-level latest-run
 * fields. The editor uses it to flip back to a previously-tested model
 * without burning tokens on a redundant rescan. */
migrate(
  (app) => {
    const c = app.findCollectionByNameOrId("scans");
    if (!c.fields.find((f) => f.name === "engineResults")) {
      c.fields.add(
        new JSONField({ name: "engineResults", maxSize: 200_000 }),
      );
    }
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId("scans");
    c.fields.removeByName("engineResults");
    app.save(c);
  },
);
