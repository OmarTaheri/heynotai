/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const c = new Collection({
      type: "base",
      name: "invoices",
      fields: [
        {
          name: "userId",
          type: "relation",
          collectionId: users.id,
          maxSelect: 1,
          required: true,
        },
        { name: "amount", type: "number", required: true },
        { name: "currency", type: "text", max: 6 },
        { name: "paidOn", type: "date" },
        { name: "pdf", type: "file", maxSelect: 1, maxSize: 10_485_760 },
        { name: "created", type: "autodate", onCreate: true },
      ],
      // Read-only for the user — invoices are written by the
      // billing webhook (admin context), never by the client.
      listRule: "userId = @request.auth.id",
      viewRule: "userId = @request.auth.id",
      createRule: null,
      updateRule: null,
      deleteRule: null,
    });
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId("invoices");
    if (c) app.delete(c);
  },
);
