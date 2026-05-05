/// <reference path="../pb_data/types.d.ts" />
/* `updates` is the public changelog feed rendered at /app/updates.
 * One row per update card. Optional widget slots (modelPreview /
 * accuracyCompare / statBand) are stored as JSON so the same
 * <UpdateCard> renders every kind without schema branching. The slug
 * is the stable id referenced by clients (matches lib/updates-data
 * ids like "u-gpt5-turbo"). Public read for any authenticated user;
 * writes are admin-only (the API service or a superuser tool). */
migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId("updates");
      return;
    } catch (_) {}
    const c = new Collection({
      type: "base",
      name: "updates",
      fields: [
        { name: "slug", type: "text", max: 80, required: true },
        {
          name: "kind",
          type: "select",
          maxSelect: 1,
          required: true,
          values: ["new-model", "accuracy", "product", "fix"],
        },
        {
          name: "contentType",
          type: "select",
          maxSelect: 1,
          values: ["txt", "img", "vid", "aud"],
        },
        {
          name: "dayGroup",
          type: "select",
          maxSelect: 1,
          required: true,
          values: ["this-week", "last-week", "earlier-april"],
        },
        { name: "timestamp", type: "text", max: 80, required: true },
        { name: "publishedAt", type: "date" },
        { name: "title", type: "text", max: 400, required: true },
        { name: "description", type: "editor" },
        { name: "meta", type: "text", max: 400 },
        { name: "ctaLabel", type: "text", max: 80 },
        { name: "ctaHref", type: "text", max: 400 },
        { name: "unread", type: "bool" },
        // Widget slots — each is an optional JSON blob shaped to match
        // the corresponding type in lib/updates-data.ts. JSON keeps the
        // schema flexible so new widget kinds can be added without a
        // migration.
        { name: "modelPreview", type: "json", maxSize: 4_000 },
        { name: "accuracyCompare", type: "json", maxSize: 2_000 },
        { name: "statBand", type: "json", maxSize: 4_000 },
        // Display order within a dayGroup. Lower = earlier in the list.
        { name: "sortOrder", type: "number" },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX `idx_updates_slug` ON `updates` (`slug`)",
        "CREATE INDEX `idx_updates_dayGroup` ON `updates` (`dayGroup`)",
        "CREATE INDEX `idx_updates_kind` ON `updates` (`kind`)",
      ],
      // Public read for any authenticated user. Writes are admin-only.
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: null,
      updateRule: null,
      deleteRule: null,
    });
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId("updates");
    if (c) app.delete(c);
  },
);
