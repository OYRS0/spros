import {
  identity,
  errorResponse,
  checkOrigin,
  readBody,
  rateLimit,
  HttpError,
} from "@/lib/server/security";
import { getDataset } from "@/lib/server/repository";
import { database } from "@/lib/server/database";
import { requestSchema } from "@/lib/domain/validation";
import { nearbySimilar } from "@/lib/domain/geo";
export async function GET() {
  try {
    return Response.json(await getDataset(await identity()), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = (await identity(true))!;
    const r = requestSchema.parse(await readBody(request));
    const existing = await getDataset(user);
    const similar = nearbySimilar(existing.requests, r, r.category, r.title);
    if (similar.length && !r.confirmedDistinct)
      return Response.json(
        {
          error:
            "Похожий запрос уже есть рядом. Присоединитесь к нему или подтвердите, чем отличается ваш.",
          similar: similar.map((s) => s.id),
        },
        { status: 409 },
      );
    await rateLimit(user.id, "create-request", 3, 86400);
    const id = crypto.randomUUID();
    const now = Date.now();
    const db = database();
    await db.batch([
      db
        .prepare(
          "INSERT INTO requests (id,title,category,location,district,lat,lng,description,needs,avg_check,owner_id,is_demo,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          r.title,
          r.category,
          r.location,
          r.district,
          r.lat,
          r.lng,
          r.description,
          JSON.stringify(r.needs),
          r.avgCheck,
          user.id,
          1,
          "published",
          now,
        ),
      db
        .prepare(
          "INSERT INTO supports (request_id,user_id,pledge,created_at) VALUES (?,?,?,?)",
        )
        .bind(id, user.id, r.pledge, now),
    ]);
    return Response.json({ id }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
