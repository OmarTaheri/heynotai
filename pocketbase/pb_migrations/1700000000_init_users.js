/// <reference path="../pb_data/types.d.ts" />
/* Extend the built-in `users` auth collection with heynotai-specific
 * profile + billing + plan fields. Idempotent: the up() function adds
 * fields only if they're missing. */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    const existing = new Set(users.fields.map((f) => f.name));
    const add = (def) => {
      if (!existing.has(def.name)) users.fields.add(def);
    };

    add({ name: "name", type: "text", max: 200 });
    add({ name: "handle", type: "text", max: 60 });
    add({ name: "avatar", type: "file", maxSelect: 1, maxSize: 5_242_880, mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] });
    add({ name: "timezone", type: "text", max: 80 });
    add({
      name: "language",
      type: "select",
      maxSelect: 1,
      values: ["en", "es", "fr", "de", "zh", "ar", "ja"],
    });
    add({
      name: "plan",
      type: "select",
      maxSelect: 1,
      values: ["check", "verify", "certify", "team"],
    });
    add({ name: "planBadge", type: "text", max: 40 });
    add({ name: "planRenewsOn", type: "date" });
    add({ name: "billingEmail", type: "email" });
    add({ name: "billingAddress", type: "text", max: 500 });
    add({ name: "paymentMethodLast4", type: "text", max: 8 });
    add({ name: "paymentExpires", type: "text", max: 8 });
    add({ name: "taxId", type: "text", max: 60 });

    // `team` rel is added in 1700000001_teams once the teams collection
    // exists — keeping the dependency order one-way.

    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const drop = [
      "name",
      "handle",
      "avatar",
      "timezone",
      "language",
      "plan",
      "planBadge",
      "planRenewsOn",
      "billingEmail",
      "billingAddress",
      "paymentMethodLast4",
      "paymentExpires",
      "taxId",
    ];
    for (const name of drop) {
      const f = users.fields.find((x) => x.name === name);
      if (f) users.fields.remove(f.id);
    }
    app.save(users);
  },
);
