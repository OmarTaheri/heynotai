import { Hono } from "hono";
import { create } from "./create.js";
import { list } from "./list.js";
import { get } from "./get.js";
import { patch } from "./patch.js";
import { del } from "./del.js";
import { rescan } from "./rescan.js";

/* `/scans` router. Each verb is its own file so middleware (bodyLimit
 * for create, optional auth on get) can be local to where it's used.
 * `requireAuth` is applied per-router rather than at the top level
 * because `get` deliberately allows anonymous reads of public-share
 * scans before falling back to auth. */
export const scans = new Hono();

scans.route("/", create);
scans.route("/", list);
scans.route("/", get);
scans.route("/", patch);
scans.route("/", del);
scans.route("/", rescan);
