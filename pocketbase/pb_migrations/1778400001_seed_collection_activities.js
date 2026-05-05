/// <reference path="../pb_data/types.d.ts" />
/* Seed one `collection.created` activity row per existing
 * `collections` record so the right-rail Activity panel is never
 * empty for legacy collections. Rows carry `payload.seeded = true`
 * so the down migration can target only the seeded set.
 *
 * Skips any collection that already has at least one activity row,
 * so re-running the migration is a no-op.
 */
migrate(
  (app) => {
    let activitiesCol;
    try {
      activitiesCol = app.findCollectionByNameOrId("collection_activities");
    } catch (_) {
      return;
    }

    let collections;
    try {
      collections = app.findRecordsByFilter("collections", "id != ''");
    } catch (_) {
      return;
    }

    for (const coll of collections) {
      const ownerId = coll.get("userId");
      if (!ownerId) continue;

      let existing = null;
      try {
        existing = app.findFirstRecordByFilter(
          "collection_activities",
          "collection = {:c}",
          { c: coll.id },
        );
      } catch (_) {}
      if (existing) continue;

      const r = new Record(activitiesCol);
      r.set("collection", coll.id);
      r.set("actor", ownerId);
      r.set("type", "collection.created");
      r.set("payload", { seeded: true });
      app.save(r);
    }
  },
  (app) => {
    try {
      const seeded = app.findRecordsByFilter(
        "collection_activities",
        "payload.seeded = true",
      );
      for (const r of seeded) {
        app.delete(r);
      }
    } catch (_) {}
  },
);
