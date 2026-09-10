import { env } from "cloudflare:workers";
import { seedDemands, seedOffers } from "@/lib/domain/seed";
export function database(): D1Database {
  if (!env.DB) throw new Error("База временно недоступна. Попробуйте позже.");
  return env.DB;
}
export function bucket(): R2Bucket {
  if (!env.BUCKET) throw new Error("Загрузка изображений временно недоступна.");
  return env.BUCKET;
}
let seeded = false;
/** Idempotent bounded sample records; no schema mutations at runtime. */
export async function ensureExamples() {
  if (seeded) return;
  const db = database();
  const found = await db
    .prepare("SELECT id FROM requests WHERE id = ?")
    .bind("d1")
    .first();
  if (found) {
    seeded = true;
    return;
  }
  const statements = seedDemands.map((r) =>
    db
      .prepare(
        "INSERT OR IGNORE INTO requests (id,title,category,location,district,lat,lng,description,needs,avg_check,seed_votes,seed_pledgers,seed_pledge_total,is_demo,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      )
      .bind(
        r.id,
        r.title,
        r.category,
        r.location,
        r.district,
        r.lat,
        r.lng,
        r.description,
        JSON.stringify(r.needs),
        r.avgCheck,
        r.seedVotes,
        r.seedPledgers,
        r.seedPledgeTotal,
        1,
        r.status,
        r.createdAt,
      ),
  );
  for (const o of seedOffers)
    statements.push(
      db
        .prepare(
          "INSERT OR IGNORE INTO offers (id,request_id,title,category,location,lat,lng,description,budget,funding_needed,timeline,benefit,avg_check,is_demo,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          o.id,
          o.requestId,
          o.title,
          o.category,
          o.location,
          o.lat,
          o.lng,
          o.description,
          o.budget,
          o.fundingNeeded,
          o.timeline,
          o.benefit,
          o.avgCheck,
          1,
          o.createdAt,
        ),
    );
  await db.batch(statements);
  seeded = true;
}
