/// <reference path="../pb_data/types.d.ts" />
/* Add `stripeInvoiceId` to the `invoices` collection so the billing
 * webhook + /sync backfill can record which Stripe invoice each PB row
 * came from, and a unique index so duplicate webhook deliveries are
 * no-ops. */
migrate(
  (app) => {
    const c = app.findCollectionByNameOrId("invoices");
    if (!c.fields.find((f) => f.name === "stripeInvoiceId")) {
      c.fields.add(new TextField({ name: "stripeInvoiceId", max: 80 }));
    }
    const idx = "CREATE UNIQUE INDEX `idx_invoices_stripe_invoice_id` ON `invoices` (`stripeInvoiceId`) WHERE `stripeInvoiceId` != ''";
    if (!c.indexes.includes(idx)) c.indexes.push(idx);
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId("invoices");
    c.fields.removeByName("stripeInvoiceId");
    c.indexes = c.indexes.filter(
      (i) => !i.includes("idx_invoices_stripe_invoice_id"),
    );
    app.save(c);
  },
);
