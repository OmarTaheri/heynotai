/// <reference path="../pb_data/types.d.ts" />
/* `scans` is the canonical record for a single piece of content the user
 * (or extension/monitor) submitted for verification. One row per submission.
 *
 * Schema is wide on purpose: detection results, sharing, organization,
 * billing, and re-scan history are all here so future work doesn't need
 * a follow-up migration. Most fields are optional and only populated
 * when the relevant feature lights up. */
migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId("scans");
      return;
    } catch (_) {}
    const users = app.findCollectionByNameOrId("users");
    const c = new Collection({
      type: "base",
      name: "scans",
      fields: [
        // ── ownership / lifecycle ──────────────────────────────────────
        {
          name: "userId",
          type: "relation",
          collectionId: users.id,
          maxSelect: 1,
          required: true,
          cascadeDelete: true,
        },
        { name: "archived", type: "bool" },
        { name: "pinned", type: "bool" },

        // ── identity / classification ─────────────────────────────────
        { name: "title", type: "text", max: 200 },
        {
          name: "type",
          type: "select",
          maxSelect: 1,
          required: true,
          values: ["txt", "img", "aud", "vid", "web", "soc"],
        },
        { name: "subtype", type: "text", max: 32 },
        {
          name: "origin",
          type: "select",
          maxSelect: 1,
          required: true,
          values: ["paste", "link", "upload", "record", "ext", "url", "mon"],
        },
        {
          name: "status",
          type: "select",
          maxSelect: 1,
          required: true,
          values: ["queued", "scanning", "done", "failed"],
        },

        // ── content ───────────────────────────────────────────────────
        { name: "content", type: "text", max: 1_000_000 },
        // mimeTypes left empty so PB allows any; the API validates the
        // accept list explicitly so the error envelope is consistent.
        { name: "file", type: "file", maxSelect: 1, maxSize: 268_435_456 },
        { name: "sourceUrl", type: "url" },
        { name: "mimeType", type: "text", max: 128 },
        { name: "sizeBytes", type: "number" },
        { name: "fileHash", type: "text", max: 128 },
        { name: "durationMs", type: "number" },
        { name: "wordCount", type: "number" },
        { name: "language", type: "text", max: 16 },
        { name: "thumbUrl", type: "text", max: 1024 },

        // ── detection result ──────────────────────────────────────────
        {
          name: "verdict",
          type: "select",
          maxSelect: 1,
          values: ["human", "ai", "mixed", "unknown"],
        },
        { name: "confidence", type: "number", min: 0, max: 100 },
        { name: "model", type: "text", max: 128 },
        { name: "engineId", type: "text", max: 128 },
        { name: "scanStartedAt", type: "date" },
        { name: "scanCompletedAt", type: "date" },
        { name: "scanDurationMs", type: "number" },
        { name: "breakdown", type: "json", maxSize: 5_000 },
        { name: "flags", type: "json", maxSize: 200_000 },
        { name: "analysis", type: "json", maxSize: 50_000 },
        { name: "analysisVersion", type: "number" },
        { name: "error", type: "json", maxSize: 5_000 },

        // ── sharing / visibility ──────────────────────────────────────
        {
          name: "visibility",
          type: "select",
          maxSelect: 1,
          values: ["private", "unlisted", "public"],
        },
        { name: "shareToken", type: "text", max: 64 },

        // ── organization / ops ────────────────────────────────────────
        { name: "tags", type: "json", maxSize: 5_000 },
        { name: "notes", type: "text", max: 50_000 },
        // `collectionId` is a PB-reserved name (every record has
        // system collectionId/collectionName getters) — use a
        // distinct name for our soft pointer.
        { name: "collectionRef", type: "text", max: 32 },
        { name: "creditsUsed", type: "number" },

        // ── re-scan history ───────────────────────────────────────────
        { name: "parentScanId", type: "text", max: 32 },
        { name: "version", type: "number" },

        // ── timestamps (PB convention; placed last so SQL columns line up) ─
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE INDEX `idx_scans_user_created` ON `scans` (`userId`, `created` DESC)",
        "CREATE INDEX `idx_scans_user_type` ON `scans` (`userId`, `type`)",
        "CREATE UNIQUE INDEX `idx_scans_share` ON `scans` (`shareToken`) WHERE `shareToken` != ''",
      ],
      // Public-share visitors can read a record; everything else is owner-only.
      // The API enforces `userId = @request.auth.id` on create regardless of
      // what the client sends in the body, so leaving createRule simple is fine.
      listRule: "userId = @request.auth.id",
      viewRule: "userId = @request.auth.id || visibility = \"public\"",
      createRule: "userId = @request.auth.id",
      updateRule: "userId = @request.auth.id",
      deleteRule: "userId = @request.auth.id",
    });
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId("scans");
    if (c) app.delete(c);
  },
);
