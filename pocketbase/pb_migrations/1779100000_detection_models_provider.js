/// <reference path="../pb_data/types.d.ts" />
/* Add `provider` to `detection_models` so a model row can declare
 * which inference backend handles the call. Default is "hf-inference"
 * (the existing free-tier HF router) — covers text, image, and the
 * frame-by-frame video meta-detectors. Audio rows switch to "velma"
 * because HF's free serverless tier doesn't host audio-classification.
 *
 * Up: add the field with a sensible default; existing rows fall through
 * to "hf-inference" via the api's null-coalesce, so no backfill needed. */
migrate(
  (app) => {
    const c = app.findCollectionByNameOrId("detection_models");
    if (!c.fields.find((f) => f.name === "provider")) {
      c.fields.add(
        new SelectField({
          name: "provider",
          maxSelect: 1,
          values: ["hf-inference", "velma"],
        }),
      );
    }
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId("detection_models");
    c.fields.removeByName("provider");
    app.save(c);
  },
);
