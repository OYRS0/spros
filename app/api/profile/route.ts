import { z } from "zod";
import {
  checkOrigin,
  errorResponse,
  identity,
  readBody,
  rateLimit,
} from "@/lib/server/security";
import { getDataset } from "@/lib/server/repository";
import { database } from "@/lib/server/database";
export async function GET() {
  try {
    const u = await identity(true);
    const db = database();
    const d = await getDataset(u, true);
    const [appeals, events] = await Promise.all([
      db
        .prepare(
          "SELECT id,request_id,text,status,resolution,created_at FROM appeals WHERE user_id=? ORDER BY created_at DESC",
        )
        .bind(u!.id)
        .all(),
      db
        .prepare(
          "SELECT m.request_id,m.from_status,m.to_status,m.reason,m.created_at FROM moderation_events m JOIN requests r ON m.request_id=r.id WHERE r.owner_id=? ORDER BY m.created_at DESC LIMIT 100",
        )
        .bind(u!.id)
        .all(),
    ]);
    return Response.json(
      { ...d, appeals: appeals.results, events: events.results },
      { headers: { "Cache-Control": "private,no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const u = (await identity(true))!;
    await rateLimit(u.id, "profile", 20);
    const p = z
      .object({
        name: z.string().trim().min(2).max(80),
        district: z.string().trim().max(100),
      })
      .parse(await readBody(request));
    await database()
      .prepare("UPDATE users SET name=?,district=? WHERE id=?")
      .bind(p.name, p.district, u.id)
      .run();
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
