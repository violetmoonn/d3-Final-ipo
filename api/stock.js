// GET /api/stock -> { stock: { "D3 01|M": 3, ... } }  (public; only counts, no orders)
import { readDB, fail } from "./_lib.js";

export default async function handler(req, res) {
  try {
    const { db } = await readDB();
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=10, stale-while-revalidate=30");
    res.status(200).json({ stock: db.stock });
  } catch (e) { fail(res, e); }
}
