// POST /api/order  — customer reserves items to pay at pickup or by Zelle.
// Stock is held right away; the shop owner confirms or cancels from /admin.
import { updateDB, cleanLines, takeStock, newId, total, httpErr, send, fail } from "./_lib.js";

const clip = (v, n) => String(v || "").trim().slice(0, n);

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  try {
    const b = req.body || {};
    if (b.website) return send(res, 200, { ok: true, id: "OK" }); // bot honeypot
    const name = clip(b.name, 80), email = clip(b.email, 120).toLowerCase(), phone = clip(b.phone, 30);
    const method = b.method === "zelle" ? "zelle" : "pickup";
    if (!name) throw httpErr(400, "Please enter your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpErr(400, "Please enter a valid email.");
    const lines = cleanLines(b.items);

    const order = await updateDB(db => {
      takeStock(db, lines);
      const open = db.orders.filter(o => o.status === "pending" && o.email === email).length;
      if (open >= 3) throw httpErr(429, "You already have open reservations. We'll be in touch soon.");
      const o = {
        id: newId("R"), kind: "online", status: "pending", method,
        name, email, phone, note: clip(b.note, 300),
        lines: lines.map(({ key, ...l }) => ({ ...l, key })), total: total(lines),
        createdAt: new Date().toISOString()
      };
      db.orders.unshift(o);
      if (db.orders.length > 2000) db.orders.length = 2000;
      return o;
    });
    send(res, 200, { ok: true, id: order.id, total: order.total, method: order.method });
  } catch (e) { fail(res, e); }
}
