/// <reference path="../pb_data/types.d.ts" />
/* `collection_members` — links a user to a `collections` row with a role
 * and lifecycle status. Used for two things at once:
 *
 *   1. ACL — accepted rows grant the recipient view access to the host
 *      collection (see the rule update below) and, transitively, to
 *      every scan listed in `collection_items`.
 *   2. Invite inbox — pending rows back the "Requests" panel on
 *      /app/collections so the recipient can approve or reject before
 *      the share goes live.
 *
 * `userId` is set at invite-time when the recipient already has an
 * account; otherwise the API or the frontend resolves the email at
 * accept-time (deferred — first round assumes the recipient has an
 * existing account).
 */
migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId("collection_members");
      return;
    } catch (_) {}

    const users = app.findCollectionByNameOrId("users");
    const collections = app.findCollectionByNameOrId("collections");

    const c = new Collection({
      type: "base",
      name: "collection_members",
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
          name: "userId",
          type: "relation",
          collectionId: users.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: "invitedBy",
          type: "relation",
          collectionId: users.id,
          maxSelect: 1,
        },
        { name: "invitedEmail", type: "text", max: 254 },
        {
          name: "role",
          type: "select",
          maxSelect: 1,
          required: true,
          values: ["owner", "editor", "viewer"],
        },
        {
          name: "status",
          type: "select",
          maxSelect: 1,
          required: true,
          values: ["pending", "accepted", "rejected"],
        },
        { name: "message", type: "text", max: 500 },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        // One row per (collection, user). Allows multiple pending invites by email
        // for users who haven't signed up yet because userId is null in that case.
        "CREATE UNIQUE INDEX `idx_collection_members_pair` ON `collection_members` (`collection`, `userId`) WHERE `userId` != ''",
        "CREATE INDEX `idx_collection_members_user` ON `collection_members` (`userId`, `status`)",
        "CREATE INDEX `idx_collection_members_email` ON `collection_members` (`invitedEmail`, `status`)",
      ],
      // Reads — recipient + sender + collection owner can see the row.
      listRule:
        "@request.auth.id != '' && (userId = @request.auth.id || invitedBy = @request.auth.id || collection.userId = @request.auth.id)",
      viewRule:
        "@request.auth.id != '' && (userId = @request.auth.id || invitedBy = @request.auth.id || collection.userId = @request.auth.id)",
      // Only the collection owner can issue an invite.
      createRule:
        "@request.auth.id != '' && collection.userId = @request.auth.id && invitedBy = @request.auth.id",
      // Recipient updates `status`; owner manages role; sender can rescind.
      updateRule:
        "userId = @request.auth.id || collection.userId = @request.auth.id || invitedBy = @request.auth.id",
      deleteRule:
        "userId = @request.auth.id || collection.userId = @request.auth.id || invitedBy = @request.auth.id",
    });
    app.save(c);

    // Open up `collections` to accepted members for read.
    // Owners keep full mutate rights; the share lane is read-only.
    const collectionsCol = app.findCollectionByNameOrId("collections");
    collectionsCol.listRule =
      "userId = @request.auth.id || (collection_members_via_collection.userId ?= @request.auth.id && collection_members_via_collection.status ?= 'accepted')";
    collectionsCol.viewRule =
      "userId = @request.auth.id || (collection_members_via_collection.userId ?= @request.auth.id && collection_members_via_collection.status ?= 'accepted')";
    app.save(collectionsCol);
  },
  (app) => {
    try {
      const collectionsCol = app.findCollectionByNameOrId("collections");
      collectionsCol.listRule = "userId = @request.auth.id";
      collectionsCol.viewRule = "userId = @request.auth.id";
      app.save(collectionsCol);
    } catch (_) {}
    try {
      const c = app.findCollectionByNameOrId("collection_members");
      if (c) app.delete(c);
    } catch (_) {}
  },
);
