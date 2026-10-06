// POST /api/admin  (header x-admin-key: ADMIN_PASSWORD)
// actions: load | setStock | sale | setStatus
import { readDB, updateDB, catalog, cleanLines, takeStock, returnStock, newId, total,
         isAdmin, httpErr, send, fail } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  if (!process.env.ADMIN_PASSWORD) return send(res, 503, { error: "ADMIN_PASSWORD is not set in Vercel yet." });
  if (!isAdmin(req)) { await new Promise(r => setTimeout(r, 600)); return send(res, 401, { error: "Wrong password." }); }
  try {
    const b = req.body || {};
    switch (b.action) {
      case "load": {
        const { db } = await readDB();
        return send(res, 200, { catalog: catalog(), stock: db.stock, orders: db.orders });
      }
      case "setStock": {
        // b.changes: { key: number | null }  (null = stop tracking)
        const ch = b.changes || {};
        const db = await updateDB(db => {
          for (const [k, v] of Object.entries(ch)) {
            const [id] = k.split("|");
            if (!catalog().some(p => p.id === id)) continue;
            if (v === null || v === "") delete db.stock[k];
            else { const n = Math.floor(Number(v)); if (n >= 0 && n < 100000) db.stock[k] = n; }
          }
          return db;
        });
        return send(res, 200, { stock: db.stock });
      }
      case "sale": {
        // in-person sale from the register
        const lines = cleanLines(b.items);
        const pay = ["cash", "card", "zelle", "other"].includes(b.pay) ? b.pay : "cash";
        const o = await updateDB(db => {
          takeStock(db, lines);
          const o = { id: newId("S"), kind: "register", status: "paid", method: pay,
            name: String(b.name || "").slice(0, 80), lines, total: total(lines),
            createdAt: new Date().toISOString() };
          db.orders.unshift(o);
          return o;
        });
        return send(res, 200, { order: o });
      }
      case "setStatus": {
        // pending -> paid | done | cancelled ; cancelling returns the stock
        const to = b.status;
        if (!["paid", "done", "cancelled"].includes(to)) throw httpErr(400, "Bad status");
        const o = await updateDB(db => {
          const o = db.orders.find(x => x.id === b.id);
          if (!o) throw httpErr(404, "Order not found");
          if (o.status === "cancelled") throw httpErr(400, "Order is already cancelled");
          if (to === "cancelled") returnStock(db, o.lines);
          o.status = to; o.updatedAt = new Date().toISOString();
          return o;
        });
        return send(res, 200, { order: o });
      }
      default: throw httpErr(400, "Unknown action");
    }
  } catch (e) { fail(res, e); }
}
