/// <reference path="../pb_data/types.d.ts" />
/* Drop the unused `platforms` field from `users`. The onboarding flow
 * no longer captures it. (Note: `extension_prefs.platforms` is a
 * different field and is unaffected.) */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    if (users.fields.find((x) => x.name === "platforms")) {
      users.fields.removeByName("platforms");
      app.save(users);
    }
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    if (!users.fields.find((x) => x.name === "platforms")) {
      users.fields.add(new JSONField({ name: "platforms", maxSize: 4_000 }));
      app.save(users);
    }
  },
);
