/// <reference path="../pb_data/types.d.ts" />
/* `collection_activities` — append-only audit log for events that
 * happen on a `collections` row. Powers the right-rail Activity panel
 * and the "See all" history modal on /app/collections/[id].
 *
 * `type` is dot-namespaced (e.g. "item.added", "member.invited") and
 * `payload` carries the structured context the frontend formatter
 * needs to render a human-readable line. Rows are immutable — the
 * collection has no update/delete rule.
 *
 * Visibility mirrors `collection_items`: collection owners and
 * accepted members can read; only members can write, and only as
 * themselves (the rule pins `actor` to the authenticated user).
 */
migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId("collection_activities");
      return;
    } catch (_) {}

    const users = app.findCollectionByNameOrId("users");
    const collections = app.findCollectionByNameOrId("collections");

    const c = new Collection({
      type: "base",
      name: "collection_activities",
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
          name: "actor",
          type: "relation",
          collectionId: users.id,
          maxSelect: 1,
          required: true,
        },
        { name: "type", type: "text", required: true, max: 64 },
        { name: "payload", type: "json", maxSize: 20_000 },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE INDEX `idx_collection_activities_collection_created` ON `collection_activities` (`collection`, `created`)",
        "CREATE INDEX `idx_collection_activities_actor` ON `collection_activities` (`actor`)",
      ],
      listRule:
        "@request.auth.id != '' && (collection.userId = @request.auth.id || (collection.collection_members_via_collection.userId ?= @request.auth.id && collection.collection_members_via_collection.status ?= 'accepted'))",
      viewRule:
        "@request.auth.id != '' && (collection.userId = @request.auth.id || (collection.collection_members_via_collection.userId ?= @request.auth.id && collection.collection_members_via_collection.status ?= 'accepted'))",
      // The actor must be the authenticated user, and they must be
      // either the owner or an accepted member of the host collection.
      createRule:
        "@request.auth.id != '' && actor = @request.auth.id && (collection.userId = @request.auth.id || (collection.collection_members_via_collection.userId ?= @request.auth.id && collection.collection_members_via_collection.status ?= 'accepted'))",
      // Immutable audit log.
      updateRule: null,
      deleteRule: null,
    });
    app.save(c);
  },
  (app) => {
    try {
      const c = app.findCollectionByNameOrId("collection_activities");
      if (c) app.delete(c);
    } catch (_) {}
  },
);
