/// <reference path="../pb_data/types.d.ts" />
/* `collection_items` — join table linking `scans` → `collections`. A
 * scan can live in multiple collections (the user request was explicit
 * about that). The owner of the scan or any accepted member of the
 * collection can add to it; only the row's `addedBy` or the collection
 * owner can remove.
 *
 * Owning the scan is a separate concept from owning the collection,
 * which is why this is a table rather than the existing `collectionRef`
 * column on `scans`. That column predates the join model and is left in
 * place for now — nothing reads it after this migration.
 */
migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId("collection_items");
      return;
    } catch (_) {}

    const users = app.findCollectionByNameOrId("users");
    const collections = app.findCollectionByNameOrId("collections");
    const scans = app.findCollectionByNameOrId("scans");

    const c = new Collection({
      type: "base",
      name: "collection_items",
      fields: [
        {
          name: "collection",
          type: "relation",
          collectionId: collections.id,
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
        {
          name: "addedBy",
          type: "relation",
          collectionId: users.id,
          maxSelect: 1,
          required: true,
        },
        { name: "created", type: "autodate", onCreate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX `idx_collection_items_pair` ON `collection_items` (`collection`, `scanId`)",
        "CREATE INDEX `idx_collection_items_collection` ON `collection_items` (`collection`)",
        "CREATE INDEX `idx_collection_items_scan` ON `collection_items` (`scanId`)",
      ],
      // Visibility tracks the host collection — owner sees everything;
      // accepted members see everything inside their collections.
      listRule:
        "@request.auth.id != '' && (collection.userId = @request.auth.id || (collection.collection_members_via_collection.userId ?= @request.auth.id && collection.collection_members_via_collection.status ?= 'accepted'))",
      viewRule:
        "@request.auth.id != '' && (collection.userId = @request.auth.id || (collection.collection_members_via_collection.userId ?= @request.auth.id && collection.collection_members_via_collection.status ?= 'accepted'))",
      // Owner of the collection or an accepted member can add items.
      // The caller always sets `addedBy = @request.auth.id`; we enforce
      // that here so it can't be spoofed.
      createRule:
        "@request.auth.id != '' && addedBy = @request.auth.id && (collection.userId = @request.auth.id || (collection.collection_members_via_collection.userId ?= @request.auth.id && collection.collection_members_via_collection.status ?= 'accepted'))",
      deleteRule:
        "addedBy = @request.auth.id || collection.userId = @request.auth.id",
    });
    app.save(c);

    // Members of a collection can also read the scans inside it. Owner
    // of the scan keeps full visibility; public scans stay visible to
    // everyone; otherwise the join table opens the door.
    const scansCol = app.findCollectionByNameOrId("scans");
    scansCol.viewRule =
      "userId = @request.auth.id || visibility = 'public' || (collection_items_via_scanId.collection.userId ?= @request.auth.id || (collection_items_via_scanId.collection.collection_members_via_collection.userId ?= @request.auth.id && collection_items_via_scanId.collection.collection_members_via_collection.status ?= 'accepted'))";
    app.save(scansCol);
  },
  (app) => {
    try {
      const scansCol = app.findCollectionByNameOrId("scans");
      scansCol.viewRule =
        "userId = @request.auth.id || visibility = \"public\"";
      app.save(scansCol);
    } catch (_) {}
    try {
      const c = app.findCollectionByNameOrId("collection_items");
      if (c) app.delete(c);
    } catch (_) {}
  },
);
