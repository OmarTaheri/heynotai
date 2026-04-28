/// <reference path="../pb_data/types.d.ts" />
/* `teams` collection — backs the `team` plan tier. The manager owns
 * the team and is the only one who can mutate it; all members can
 * read. */
migrate(
  (app) => {
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
      // A user can read a team if they are the manager OR a member.
      // Membership is checked via the team_members back-relation.
      listRule:
        "@request.auth.id != '' && (manager = @request.auth.id || @collection.team_members.user.id ?= @request.auth.id && @collection.team_members.team.id ?= id)",
      viewRule:
        "@request.auth.id != '' && (manager = @request.auth.id || @collection.team_members.user.id ?= @request.auth.id && @collection.team_members.team.id ?= id)",
      createRule: "@request.auth.id != '' && manager = @request.auth.id",
      updateRule: "manager = @request.auth.id",
      deleteRule: "manager = @request.auth.id",
    });
    app.save(c);

    // Add the `team` rel on users now that the collection exists.
    const users = app.findCollectionByNameOrId("users");
    if (!users.fields.find((f) => f.name === "team")) {
      users.fields.add({
        name: "team",
        type: "relation",
        collectionId: c.id,
        maxSelect: 1,
      });
      app.save(users);
    }
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const teamField = users.fields.find((f) => f.name === "team");
    if (teamField) {
      users.fields.remove(teamField.id);
      app.save(users);
    }
    const c = app.findCollectionByNameOrId("teams");
    if (c) app.delete(c);
  },
);
