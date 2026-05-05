/// <reference path="../pb_data/types.d.ts" />
/* Add scheduled-downgrade fields to the `users` collection.
 *
 * PB 0.23 expects typed field constructors (`SelectField`, `TextField`,
 * `DateField`) instead of plain `{type, name, ...}` objects — the
 * legacy migrations using plain objects were never actually applied
 * via the migration system (the schema came from manual Admin UI
 * setup), which is why those errors are visible now that the
 * migrations directory is finally being scanned.
 *
 * Sorted before the legacy 1700000xxx migrations so it lands first
 * (PB stops on the first failing migration; we only need this one).
 * Idempotent: each `add` is a no-op if the field already exists. */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const existing = new Set(users.fields.map((f) => f.name));

    if (!existing.has("pendingPlan")) {
      users.fields.add(
        new SelectField({
          name: "pendingPlan",
          maxSelect: 1,
          values: ["check", "verify", "certify", "team"],
        }),
      );
    }
    if (!existing.has("pendingPlanCycle")) {
      users.fields.add(
        new TextField({ name: "pendingPlanCycle", max: 16 }),
      );
    }
    if (!existing.has("pendingPlanEffective")) {
      users.fields.add(new DateField({ name: "pendingPlanEffective" }));
    }

    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const drop = ["pendingPlan", "pendingPlanCycle", "pendingPlanEffective"];
    for (const name of drop) {
      const f = users.fields.find((x) => x.name === name);
      if (f) users.fields.remove(f.id);
    }
    app.save(users);
  },
);
