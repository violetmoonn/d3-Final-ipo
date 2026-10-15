// POST /api/drop
//   { action: "join",   email }    -> adds the email to the early-access list (db.waitlist)
//   { action: "unlock", password } -> checks the next-drop password (env DROP_PASSWORD)
import { updateDB, httpErr, send, fail } from "./_lib.js";
import { timingSafeEqual } from "node:crypto";

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

function samePassword(got) {
  const want = String(process.env.DROP_PASSWORD || "COMPOSED").trim().toUpperCase();
  const g = String(got || "").trim().toUpperCase();
  const a = Buffer.from(want), b = Buffer.from(g);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  try {
    const b = req.body || {};
    if (b.action === "join") {
      const email = String(b.email || "").trim().toLowerCase();
      if (!EMAIL.test(email)) throw httpErr(400, "Please enter a valid email.");
      const source = String(b.source || "site").slice(0, 20);
      await updateDB(db => {
        db.waitlist ||= [];
        if (!db.waitlist.some(w => w.email === email)) {
          if (db.waitlist.length >= 50000) throw httpErr(503, "The list is full right now.");
          db.waitlist.push({ email, source, at: new Date().toISOString() });
        }
        return db;
      });
      return send(res, 200, { ok: true });
    }
    if (b.action === "unlock") {
      if (!samePassword(b.password)) {
        await new Promise(r => setTimeout(r, 500));
        return send(res, 401, { error: "Wrong password." });
      }
      return send(res, 200, { ok: true });
    }
    throw httpErr(400, "Unknown action.");
  } catch (e) { fail(res, e); }
}
