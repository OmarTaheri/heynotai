/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": null,
    "deleteRule": null,
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
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text2560465762",
        "max": 80,
        "min": 1,
        "name": "slug",
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
        "id": "text1579384326",
        "max": 120,
        "min": 0,
        "name": "name",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "select2363381545",
        "maxSelect": 1,
        "name": "type",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "select",
        "values": [
          "txt",
          "img",
          "aud",
          "vid"
        ]
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text2175501037",
        "max": 200,
        "min": 0,
        "name": "hfModelId",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1304724841",
        "max": 80,
        "min": 0,
        "name": "videoFrameModelSlug",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "number230402008",
        "max": null,
        "min": null,
        "name": "videoFrameCount",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1843675174",
        "max": 600,
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
        "id": "number2470773635",
        "max": 100,
        "min": 0,
        "name": "accuracy",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "exceptDomains": null,
        "hidden": false,
        "id": "url1327994364",
        "name": "getKeyUrl",
        "onlyDomains": null,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "url"
      },
      {
        "hidden": false,
        "id": "bool1358543748",
        "name": "enabled",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "bool"
      },
      {
        "hidden": false,
        "id": "number743939940",
        "max": null,
        "min": 0,
        "name": "tokenCost",
        "onlyInt": false,
        "presentable": false,
        "required": true,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "select2593194284",
        "maxSelect": 1,
        "name": "costUnit",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": [
          "per_scan",
          "per_minute"
        ]
      },
      {
        "hidden": false,
        "id": "select741107948",
        "maxSelect": 4,
        "name": "plansAllowed",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": [
          "check",
          "verify",
          "certify",
          "team"
        ]
      },
      {
        "hidden": false,
        "id": "select93156405",
        "maxSelect": 4,
        "name": "defaultForPlans",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": [
          "check",
          "verify",
          "certify",
          "team"
        ]
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
    "id": "pbc_1962270352",
    "indexes": [
      "CREATE UNIQUE INDEX `idx_detection_models_slug` ON `detection_models` (`slug`)",
      "CREATE INDEX `idx_detection_models_type_enabled` ON `detection_models` (`type`, `enabled`)"
    ],
    "listRule": "enabled = true && @request.auth.id != ''",
    "name": "detection_models",
    "system": false,
    "type": "base",
    "updateRule": null,
    "viewRule": "enabled = true && @request.auth.id != ''"
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1962270352");

  return app.delete(collection);
})
