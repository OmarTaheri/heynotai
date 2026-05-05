/// <reference path="../pb_data/types.d.ts" />
/* Add onboarding-flow fields to the `users` collection. The 10-step
 * onboarding writes name/handle/timezone/language to existing fields,
 * theme/notifs/privacy to their dedicated *_prefs collections, and the
 * fields below directly on the user. `onboardingCompleted` is the
 * gate the post-auth redirect reads to decide /app vs /app/onboarding. */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    const existing = new Set(users.fields.map((f) => f.name));
    const add = (field) => {
      if (!existing.has(field.name)) users.fields.add(field);
    };

    add(new BoolField({ name: "onboardingCompleted" }));
    add(new TextField({ name: "role", max: 40 }));
    add(new JSONField({ name: "useCases", maxSize: 4_000 }));
    add(new JSONField({ name: "connections", maxSize: 4_000 }));
    // Optional URL avatar — distinct from the existing `avatar` file
    // field so onboarding can paste a URL without uploading a blob.
    add(new URLField({ name: "avatarUrl", presentable: false }));

    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const drop = [
      "onboardingCompleted",
      "role",
      "useCases",
      "connections",
      "avatarUrl",
    ];
    for (const name of drop) {
      users.fields.removeByName(name);
    }
    app.save(users);
  },
);
