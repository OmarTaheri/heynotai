/// <reference path="../pb_data/types.d.ts" />
/* `teams` collection — backs the `team` plan tier. The manager owns
 * the team and is the only one who can mutate it; all members can
 * read. */
migrate(
  (app) => {
    // Idempotent guard: if `teams` already exists (created by a prior
    // app run before migrations were tracked), record the migration
    // as applied without trying to recreate it.
    try {
      app.findCollectionByNameOrId("teams");
      return;
    } catch (_) {}

    const c = new Collection({
      type: "base",
      name: "teams",
      fields: [
        { name: "name", type: "text", max: 120, required: true },
        {
          name: "manager",
          type: "relation",
          collectionId: app.findCollectionByNameOrId("users").id,
          maxSelect: 1,
          required: true,
        },
        { name: "seatLimit", type: "number", min: 1 },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      // Manager-only access at create time. The full
      // "manager OR member via team_members" rule can't be set here
      // because team_members doesn't exist yet at this migration's
      // apply time — that broader rule should be applied by a later
      // migration once team_members is in the schema.
      listRule:
        "@request.auth.id != '' && manager = @request.auth.id",
      viewRule:
        "@request.auth.id != '' && manager = @request.auth.id",
      createRule: "@request.auth.id != '' && manager = @request.auth.id",
      updateRule: "manager = @request.auth.id",
      deleteRule: "manager = @request.auth.id",
    });
    app.save(c);

    // Add the `team` rel on users now that the collection exists.
    const users = app.findCollectionByNameOrId("users");
    if (!users.fields.find((f) => f.name === "team")) {
      users.fields.add(new RelationField({
        name: "team",
        collectionId: c.id,
        maxSelect: 1,
      }));
      app.save(users);
    }
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.removeByName("team");
    app.save(users);
    try {
      const c = app.findCollectionByNameOrId("teams");
      if (c) app.delete(c);
    } catch (_) {}
  },
);
