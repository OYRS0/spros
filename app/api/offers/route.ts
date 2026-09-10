import { offerSchema } from "@/lib/domain/validation";
import { database } from "@/lib/server/database";
import {
  checkOrigin,
  errorResponse,
  HttpError,
  identity,
  rateLimit,
  readBody,
} from "@/lib/server/security";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = (await identity(true))!;
    const o = offerSchema.parse(await readBody(request));
    const db = database();
    if (o.requestId) {
      const r = await db
        .prepare(
          "SELECT category,location,lat,lng FROM requests WHERE id=? AND status IN ('published','review','restored')",
        )
        .bind(o.requestId)
        .first<{
          category: typeof o.category;
          location: string;
          lat: number;
          lng: number;
        }>();
      if (!r) throw new HttpError("Запрос недоступен.", 404);
      Object.assign(o, r);
    }
    if (o.photoKey) {
      const photo = await db
        .prepare("SELECT id FROM media WHERE id=? AND owner_id=?")
        .bind(o.photoKey, user.id)
        .first();
      if (!photo)
        throw new HttpError("Загрузите собственное изображение.", 403);
    }
    await rateLimit(user.id, "create-offer", 3, 86400);
    const id = crypto.randomUUID();
    await db
      .prepare(
        "INSERT INTO offers (id,request_id,title,category,location,lat,lng,description,budget,funding_needed,timeline,benefit,avg_check,photo_key,owner_id,is_demo,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      )
      .bind(
        id,
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
        o.photoKey,
        user.id,
        1,
        Date.now(),
      )
      .run();
    return Response.json({ id }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
