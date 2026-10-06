// Shared helpers for the D3COMPOSURE store API.
// Data lives in one private Vercel Blob file (store/db.json):
//   { stock: { "D3 01|M": 3, "M01|L|black": 5 }, orders: [ ... ] }
// A stock key that is missing means "not tracked" (always available).
import { get, put } from "@vercel/blob";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { timingSafeEqual, randomBytes } from "node:crypto";

const DB_PATH = "store/db.json";

/* ---------- catalog: read straight from index.html so there is one source ---------- */
let CATALOG = null;
export function catalog() {
  if (CATALOG) return CATALOG;
  const html = readFileSync(join(process.cwd(), "index.html"), "utf8");
  const start = html.indexOf("/* ---------- catalogue ---------- */");
  const end = html.indexOf("const PRODUCTS =", start);
  const endLine = html.indexOf("\n", end);
  if (start < 0 || end < 0) throw new Error("catalog markers not found in index.html");
  const code = html.slice(start, endLine) + "\n;PRODUCTS;";
  const list = vm.runInNewContext(code, {}, { timeout: 500 });
  CATALOG = list.map(p => ({
    id: p.id, name: p.name || p.id, usd: p.usd, sizes: p.sizes || ["OS"],
    colors: p.colors || null, color: p.color || null,
    img: (p.imgs && p.imgs[0] && p.imgs[0].src) || ""
  }));
  return CATALOG;
}
export const findProduct = id => catalog().find(p => p.id === id);

/* ---------- db ---------- */
export async function readDB() {
  try {
    const r = await get(DB_PATH, { access: "private", useCache: false });
    if (!r || r.statusCode !== 200) return { db: { stock: {}, orders: [] }, etag: null };
    const text = await new Response(r.stream).text();
    const db = JSON.parse(text);
    db.stock ||= {}; db.orders ||= [];
    return { db, etag: r.blob.etag };
  } catch (e) {
    if (String(e && (e.name || e.message)).match(/NotFound|not found|404/i)) return { db: { stock: {}, orders: [] }, etag: null };
    throw e;
  }
}

// Read-modify-write with an ETag check so two sales at once can't overwrite each other.
export async function updateDB(fn) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { db, etag } = await readDB();
    const result = await fn(db);
    try {
      await put(DB_PATH, JSON.stringify(db), {
        access: "private", contentType: "application/json",
        addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60,
        ...(etag ? { ifMatch: etag } : {})
      });
      return result;
    } catch (e) {
      if (attempt === 4 || !String(e && e.message).match(/precondition|etag|412|exists/i)) throw e;
    }
  }
}

/* ---------- stock helpers ---------- */
export const keyOf = (id, size, color) => [id, size, color].filter(Boolean).join("|");
export const available = (db, key) => (key in db.stock ? db.stock[key] : Infinity);

// Validates a list of {id,size,color,qty}, returns clean lines with server-side prices.
export function cleanLines(items) {
  if (!Array.isArray(items) || !items.length || items.length > 40) throw httpErr(400, "Your bag is empty.");
  return items.map(it => {
    const p = findProduct(String(it.id || ""));
    const qty = Math.floor(Number(it.qty));
    if (!p || !(qty >= 1 && qty <= 20)) throw httpErr(400, "An item in your bag is no longer available.");
    const size = String(it.size || "");
    if (!p.sizes.includes(size)) throw httpErr(400, "Please pick a size for " + p.name + ".");
    let color = it.color ? String(it.color) : null;
    if (p.colors && !p.colors.includes(color)) color = p.color;
    if (!p.colors) color = null;
    return { id: p.id, name: p.name, size, color, qty, usd: p.usd, key: keyOf(p.id, size, color) };
  });
}

// Takes stock for every line or none of them. Throws if anything is short.
export function takeStock(db, lines) {
  const need = {};
  lines.forEach(l => need[l.key] = (need[l.key] || 0) + l.qty);
  for (const [k, q] of Object.entries(need)) {
    if (available(db, k) < q) {
      const l = lines.find(x => x.key === k);
      const left = available(db, k);
      throw httpErr(409, left > 0
        ? `Only ${left} left of ${l.name} (size ${l.size}).`
        : `${l.name} in size ${l.size} just sold out.`);
    }
  }
  for (const [k, q] of Object.entries(need)) if (k in db.stock) db.stock[k] -= q;
}
export function returnStock(db, lines) {
  lines.forEach(l => { if (l.key in db.stock) db.stock[l.key] += l.qty; });
}

/* ---------- misc ---------- */
export function httpErr(status, message) { const e = new Error(message); e.status = status; return e; }
export const newId = prefix => prefix + "-" + Date.now().toString(36).toUpperCase().slice(-5) + randomBytes(2).toString("hex").toUpperCase();
export const total = lines => lines.reduce((a, l) => a + l.usd * l.qty, 0);

export function isAdmin(req) {
  const want = process.env.ADMIN_PASSWORD || "";
  const got = String(req.headers["x-admin-key"] || "");
  if (want.length < 8 || !got) return false;
  const a = Buffer.from(want), b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  res.status(status).json(body);
}
export function fail(res, e) {
  console.error(e);
  send(res, e.status || 500, { error: e.status ? e.message : "Something went wrong. Please try again." });
}
