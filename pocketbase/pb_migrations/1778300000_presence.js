/// <reference path="../pb_data/types.d.ts" />
/* `presence` — one row per (user, scan) while that user has the scan's
 * editor open. The frontend upserts `lastSeen` on a 15s heartbeat and
 * deletes the row on unmount; clients subscribe via PB realtime to render
 * a live "who's here" avatar stack on the editor.
 *
 * Read rules mirror `scans` access: a user can see presence rows for any
 * scan they themselves can view (owner, public, or accepted member of a
 * collection the scan is in). Write rules are self-only.
 */
migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId("presence");
      return;
    } catch (_) {}

    const users = app.findCollectionByNameOrId("users");
    const scans = app.findCollectionByNameOrId("scans");

    const c = new Collection({
      type: "base",
      name: "presence",
      fields: [
        {
          name: "userId",
          type: "relation",
          collectionId: users.id,
          maxSelect: 1,
          required: true,
          cascadeDelete: true,
        },
        {
          name: "scanId",
          type: "relation",
          collectionId: scans.id,
          maxSelect: 1,
          required: true,
          cascadeDelete: true,
        },
        { name: "lastSeen", type: "autodate", onCreate: true, onUpdate: true },
        { name: "created", type: "autodate", onCreate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX `idx_presence_pair` ON `presence` (`userId`, `scanId`)",
        "CREATE INDEX `idx_presence_scan` ON `presence` (`scanId`)",
      ],
      // Anyone with read access to the scan can see who's on it.
      listRule:
        "@request.auth.id != '' && (scanId.userId = @request.auth.id || scanId.visibility = 'public' || (scanId.collection_items_via_scanId.collection.userId ?= @request.auth.id) || (scanId.collection_items_via_scanId.collection.collection_members_via_collection.userId ?= @request.auth.id && scanId.collection_items_via_scanId.collection.collection_members_via_collection.status ?= 'accepted'))",
      viewRule:
        "@request.auth.id != '' && (scanId.userId = @request.auth.id || scanId.visibility = 'public' || (scanId.collection_items_via_scanId.collection.userId ?= @request.auth.id) || (scanId.collection_items_via_scanId.collection.collection_members_via_collection.userId ?= @request.auth.id && scanId.collection_items_via_scanId.collection.collection_members_via_collection.status ?= 'accepted'))",
      // You can only write your own presence row.
      createRule:
        "@request.auth.id != '' && userId = @request.auth.id",
      updateRule:
        "userId = @request.auth.id",
      deleteRule:
        "userId = @request.auth.id",
    });
    app.save(c);
  },
  (app) => {
    try {
      const c = app.findCollectionByNameOrId("presence");
      if (c) app.delete(c);
    } catch (_) {}
  },
);
