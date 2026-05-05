/// <reference path="../pb_data/types.d.ts" />
/* Extend the built-in `users` auth collection with heynotai-specific
 * profile + billing + plan fields. Idempotent: the up() function adds
 * fields only if they're missing. */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    const existing = new Set(users.fields.map((f) => f.name));
    const add = (field) => {
      if (!existing.has(field.name)) users.fields.add(field);
    };

    add(new TextField({ name: "name", max: 200 }));
    add(new TextField({ name: "handle", max: 60 }));
    add(new FileField({ name: "avatar", maxSelect: 1, maxSize: 5_242_880, mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] }));
    add(new TextField({ name: "timezone", max: 80 }));
    add(new SelectField({
      name: "language",
      maxSelect: 1,
      values: ["en", "es", "fr", "de", "zh", "ar", "ja"],
    }));
    add(new SelectField({
      name: "plan",
      maxSelect: 1,
      values: ["check", "verify", "certify", "team"],
    }));
    add(new TextField({ name: "planCycle", max: 16 }));
    add(new TextField({ name: "planBadge", max: 40 }));
    add(new DateField({ name: "planRenewsOn" }));
    add(new EmailField({ name: "billingEmail" }));
    add(new TextField({ name: "billingAddress", max: 500 }));
    add(new TextField({ name: "billingCountry", max: 4 }));
    add(new TextField({ name: "paymentBrand", max: 32 }));
    add(new TextField({ name: "paymentLast4", max: 8 }));
    add(new TextField({ name: "paymentExpires", max: 8 }));
    add(new TextField({ name: "taxId", max: 60 }));
    add(new TextField({ name: "stripeCustomerId", max: 80 }));
    add(new TextField({ name: "stripeSubscriptionId", max: 80 }));

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
      "planCycle",
      "planBadge",
      "planRenewsOn",
      "billingEmail",
      "billingAddress",
      "billingCountry",
      "paymentBrand",
      "paymentLast4",
      "paymentExpires",
      "taxId",
      "stripeCustomerId",
      "stripeSubscriptionId",
    ];
    for (const name of drop) {
      users.fields.removeByName(name);
    }
    app.save(users);
  },
);
