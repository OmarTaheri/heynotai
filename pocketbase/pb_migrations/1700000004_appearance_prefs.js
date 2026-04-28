/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const c = new Collection({
      type: "base",
      name: "appearance_prefs",
      fields: [
        {
          name: "userId",
          type: "relation",
          collectionId: users.id,
          maxSelect: 1,
          required: true,
        },
        {
          name: "theme",
          type: "select",
          maxSelect: 1,
          values: ["paper", "night", "system"],
        },
        { name: "dateFormat", type: "text", max: 40 },
        { name: "showAuthenticVerdicts", type: "bool" },
        { name: "reduceMotion", type: "bool" },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX `idx_appearance_prefs_user` ON `appearance_prefs` (`userId`)",
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
    const c = app.findCollectionByNameOrId("appearance_prefs");
    if (c) app.delete(c);
  },
);
