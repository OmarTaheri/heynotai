/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId("privacy_prefs");
      return;
    } catch (_) {}
    const users = app.findCollectionByNameOrId("users");
    const c = new Collection({
      type: "base",
      name: "privacy_prefs",
      fields: [
        {
          name: "userId",
          type: "relation",
          collectionId: users.id,
          maxSelect: 1,
          required: true,
        },
        { name: "scanRetention", type: "text", max: 40 },
        { name: "modelTraining", type: "bool" },
        { name: "anonymousAnalytics", type: "bool" },
        { name: "publicProfile", type: "bool" },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX `idx_privacy_prefs_user` ON `privacy_prefs` (`userId`)",
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
    const c = app.findCollectionByNameOrId("privacy_prefs");
    if (c) app.delete(c);
  },
);
