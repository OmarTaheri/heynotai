/// <reference path="../pb_data/types.d.ts" />
/* Add `velmaApiKey` next to `huggingfaceToken` on `service_secrets`.
 * The api's `loadVelmaApiKey()` helper reads from this field so the
 * operator pastes the key in the PB admin UI rather than wiring an
 * env var (matches the existing HF-token pattern). */
migrate(
  (app) => {
    const c = app.findCollectionByNameOrId("service_secrets");
    if (!c.fields.find((f) => f.name === "velmaApiKey")) {
      c.fields.add(
        new TextField({
          name: "velmaApiKey",
          max: 200,
          hidden: true,
        }),
      );
    }
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId("service_secrets");
    c.fields.removeByName("velmaApiKey");
    app.save(c);
  },
);
