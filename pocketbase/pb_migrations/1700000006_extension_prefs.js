/// <reference path="../pb_data/types.d.ts" />
/* `extension_prefs` is the bidirectional row edited from BOTH the
 * extension drawer Settings tab AND the frontend /app/extension page.
 * One row per user; PB realtime pushes changes to both surfaces. */
migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId("extension_prefs");
      return;
    } catch (_) {}
    const users = app.findCollectionByNameOrId("users");
    const c = new Collection({
      type: "base",
      name: "extension_prefs",
      fields: [
        {
          name: "userId",
          type: "relation",
          collectionId: users.id,
          maxSelect: 1,
          required: true,
        },
        {
          name: "mode",
          type: "select",
          maxSelect: 1,
          values: ["normal", "power"],
        },
        { name: "autoModelMode", type: "bool" },
        {
          name: "scanMode",
          type: "select",
          maxSelect: 1,
          values: ["allowlist", "manual", "everything"],
        },
        { name: "sites", type: "json", maxSize: 200_000 },
        { name: "platforms", type: "json", maxSize: 10_000 },
        { name: "notifications", type: "json", maxSize: 10_000 },
        { name: "privacy", type: "json", maxSize: 10_000 },
        { name: "hotkeys", type: "json", maxSize: 20_000 },
        { name: "flags", type: "json", maxSize: 20_000 },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX `idx_extension_prefs_user` ON `extension_prefs` (`userId`)",
      ],
      listRule: "userId = @request.auth.id",
      viewRule: "userId = @request.auth.id",
      createRule: "userId = @request.auth.id",
      updateRule: "userId = @request.auth.id",
      deleteRule: "userId = @request.auth.id",
    });
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId("extension_prefs");
    if (c) app.delete(c);
  },
);
