/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2074168516")

  // update collection data
  unmarshal({
    "createRule": "@request.auth.id != \"\"",
    "deleteRule": "@request.auth.id != \"\"",
    "listRule": "@request.auth.id != \"\"",
    "updateRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\""
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2074168516")

  // update collection data
  unmarshal({
    "createRule": "@request.auth.id != '' && collection.userId = @request.auth.id && invitedBy = @request.auth.id",
    "deleteRule": "userId = @request.auth.id || collection.userId = @request.auth.id || invitedBy = @request.auth.id",
    "listRule": "@request.auth.id != '' && (userId = @request.auth.id || invitedBy = @request.auth.id || collection.userId = @request.auth.id)",
    "updateRule": "userId = @request.auth.id || collection.userId = @request.auth.id || invitedBy = @request.auth.id",
    "viewRule": "@request.auth.id != '' && (userId = @request.auth.id || invitedBy = @request.auth.id || collection.userId = @request.auth.id)"
  }, collection)

  return app.save(collection)
})
