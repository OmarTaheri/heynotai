/// <reference path="../pb_data/types.d.ts" />
/* Add `tier` to `detection_models` — the single source of truth for
 * which plan can use a model. The picker UIs (extension drawer +
 * frontend /app/models) show all enabled models tagged with their
 * tier and lock rows above the user's current plan; the scan
 * endpoints validate `PLAN_RANK[row.tier] <= PLAN_RANK[user.plan]`
 * before running the detector.
 *
 * Default is "check" (free) so existing rows remain reachable by
 * everyone until an operator re-runs `seed-models.sh`, which assigns
 * a real tier per the cost ladder.
 *
 * The legacy `plansAllowed` and `defaultForPlans` fields are left in
 * place so older deployments don't crash on read; the API ignores
 * them once `tier` is set. */
migrate(
  (app) => {
    const c = app.findCollectionByNameOrId("detection_models");
    if (!c.fields.find((f) => f.name === "tier")) {
      c.fields.add(
        new SelectField({
          name: "tier",
          maxSelect: 1,
          values: ["check", "verify", "certify", "team"],
        }),
      );
    }
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId("detection_models");
    c.fields.removeByName("tier");
    app.save(c);
  },
);
