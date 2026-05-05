/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // remove field
  collection.fields.removeById("select965033794")

  // remove field
  collection.fields.removeById("text306596248")

  // remove field
  collection.fields.removeById("date3094439122")

  // remove field
  collection.fields.removeById("relation3303056927")

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // add field
  collection.fields.addAt(31, new Field({
    "hidden": false,
    "id": "select965033794",
    "maxSelect": 1,
    "name": "pendingPlan",
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
  }))

  // add field
  collection.fields.addAt(32, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text306596248",
    "max": 16,
    "min": 0,
    "name": "pendingPlanCycle",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(33, new Field({
    "hidden": false,
    "id": "date3094439122",
    "max": "",
    "min": "",
    "name": "pendingPlanEffective",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "date"
  }))

  // add field
  collection.fields.addAt(34, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_1568971955",
    "hidden": false,
    "id": "relation3303056927",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "team",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
})
