/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const c = new Collection({
      type: "base",
      name: "data_exports",
      fields: [
        {
          name: "userId",
          type: "relation",
          collectionId: users.id,
          maxSelect: 1,
          required: true,
        },
        {
          name: "kind",
          type: "select",
          maxSelect: 1,
          values: ["everything", "library", "reports"],
          required: true,
        },
        {
          name: "status",
          type: "select",
          maxSelect: 1,
          values: ["pending", "ready", "failed"],
          required: true,
        },
        { name: "file", type: "file", maxSelect: 1, maxSize: 524_288_000 },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      // User can request an export; status + file are flipped by the worker.
      listRule: "userId = @request.auth.id",
      viewRule: "userId = @request.auth.id",
      createRule: "userId = @request.auth.id",
      updateRule: null,
      deleteRule: "userId = @request.auth.id",
    });
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId("data_exports");
    if (c) app.delete(c);
  },
);
