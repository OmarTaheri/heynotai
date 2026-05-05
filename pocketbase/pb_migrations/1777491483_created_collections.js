/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": "@request.auth.id != '' && userId = @request.auth.id",
    "deleteRule": "userId = @request.auth.id",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "cascadeDelete": true,
        "collectionId": "_pb_users_auth_",
        "hidden": false,
        "id": "relation1689669068",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "userId",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text2560465762",
        "max": 80,
        "min": 1,
        "name": "slug",
        "pattern": "^[a-z0-9]+(-[a-z0-9]+)*$",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text724990059",
        "max": 120,
        "min": 1,
        "name": "title",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1843675174",
        "max": 500,
        "min": 0,
        "name": "description",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "select1077196596",
        "maxSelect": 1,
        "name": "tone",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "select",
        "values": [
          "human",
          "ai",
          "mixed",
          "info",
          "gold",
          "neutral"
        ]
      },
      {
        "hidden": false,
        "id": "select2747071630",
        "maxSelect": 1,
        "name": "pattern",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "select",
        "values": [
          "dots",
          "grid",
          "lines"
        ]
      },
      {
        "hidden": false,
        "id": "bool3844597223",
        "name": "pinned",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "bool"
      },
      {
        "hidden": false,
        "id": "autodate2990389176",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate3332085495",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "id": "pbc_601157786",
    "indexes": [
      "CREATE UNIQUE INDEX `idx_collections_slug` ON `collections` (`slug`)",
      "CREATE INDEX `idx_collections_user` ON `collections` (`userId`)"
    ],
    "listRule": "userId = @request.auth.id",
    "name": "collections",
    "system": false,
    "type": "base",
    "updateRule": "userId = @request.auth.id",
    "viewRule": "userId = @request.auth.id"
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_601157786");

  return app.delete(collection);
})
