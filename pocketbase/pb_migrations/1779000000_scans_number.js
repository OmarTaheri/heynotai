/// <reference path="../pb_data/types.d.ts" />
/* Add `number` to the `scans` collection — a per-user 1-based sequence
 * assigned at create time so the editor can show "#42 no title" instead
 * of the hardcoded "#1" placeholder. The number is a *display label*,
 * not an invariant: the create path computes it via max+1, which races
 * harmlessly across simultaneous creates by the same user. The
 * `idx_scans_user_number` index keeps that lookup O(1).
 *
 * Up: add the field, add the index, then backfill — for each user,
 * order their scans by `created` ascending and assign 1..N. */
migrate(
  (app) => {
    const c = app.findCollectionByNameOrId("scans");
    if (!c.fields.find((f) => f.name === "number")) {
      c.fields.add(new NumberField({ name: "number", min: 0, onlyInt: true }));
    }
    if (!c.indexes.find((i) => i.includes("idx_scans_user_number"))) {
      c.indexes = [
        ...c.indexes,
        "CREATE INDEX `idx_scans_user_number` ON `scans` (`userId`, `number` DESC)",
      ];
    }
    app.save(c);

    const users = app.findRecordsByFilter("users", "", "", 0, 0);
    for (const u of users) {
      const rows = app.findRecordsByFilter(
        "scans",
        `userId = "${u.id}"`,
        "+created",
        0,
        0,
      );
      let n = 1;
      for (const r of rows) {
        if (!r.get("number")) {
          r.set("number", n);
          app.save(r);
        }
        n += 1;
      }
    }
  },
  (app) => {
    const c = app.findCollectionByNameOrId("scans");
    c.indexes = c.indexes.filter((i) => !i.includes("idx_scans_user_number"));
    c.fields.removeByName("number");
    app.save(c);
  },
);
