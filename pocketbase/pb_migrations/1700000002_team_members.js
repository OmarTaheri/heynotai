/// <reference path="../pb_data/types.d.ts" />
/* Membership rows linking users to teams. Manager can write; member
 * can read their own row + sibling members in the same team. */
migrate(
  (app) => {
    const teams = app.findCollectionByNameOrId("teams");
    const users = app.findCollectionByNameOrId("users");

    const c = new Collection({
      type: "base",
      name: "team_members",
      fields: [
        {
          name: "team",
          type: "relation",
          collectionId: teams.id,
          maxSelect: 1,
          required: true,
        },
        {
          name: "user",
          type: "relation",
          collectionId: users.id,
          maxSelect: 1,
          required: true,
        },
        {
          name: "role",
          type: "select",
          maxSelect: 1,
          values: ["manager", "member"],
          required: true,
        },
        {
          name: "invitedBy",
          type: "relation",
          collectionId: users.id,
          maxSelect: 1,
        },
        { name: "joinedAt", type: "autodate", onCreate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX `idx_team_members_user_team` ON `team_members` (`team`, `user`)",
      ],
      listRule:
        "@request.auth.id != '' && (user = @request.auth.id || team.manager = @request.auth.id || @collection.team_members.user.id ?= @request.auth.id && @collection.team_members.team ?= team)",
      viewRule:
        "@request.auth.id != '' && (user = @request.auth.id || team.manager = @request.auth.id)",
      createRule: "team.manager = @request.auth.id",
      updateRule: "team.manager = @request.auth.id",
      deleteRule: "team.manager = @request.auth.id",
    });
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId("team_members");
    if (c) app.delete(c);
  },
);
