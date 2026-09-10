import { actionSchema } from "@/lib/domain/validation";
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
    const u = (await identity(true))!;
    const a = actionSchema.parse(await readBody(request));
    const db = database();
    const now = Date.now();
    await rateLimit(
      u.id,
      a.action,
      a.action === "report" ? 10 : a.action === "appeal" ? 5 : 60,
    );
    if ("requestId" in a) {
      const r = await db
        .prepare("SELECT id,owner_id,status FROM requests WHERE id=?")
        .bind(a.requestId)
        .first<{ id: string; owner_id: string | null; status: string }>();
      if (!r) throw new HttpError("Запрос не найден.", 404);
      if (a.action === "appeal") {
        if (r.owner_id !== u.id)
          throw new HttpError("Апелляцию может подать только автор.", 403);
        if (r.status !== "hidden")
          throw new HttpError("Апелляция доступна для скрытого запроса.", 409);
        const pending = await db
          .prepare(
            "SELECT id FROM appeals WHERE request_id=? AND status='open'",
          )
          .bind(r.id)
          .first();
        if (pending) throw new HttpError("Апелляция уже ожидает решения.", 409);
        await db
          .prepare(
            "INSERT INTO appeals (id,request_id,user_id,text,created_at) VALUES (?,?,?,?,?)",
          )
          .bind(crypto.randomUUID(), r.id, u.id, a.text, now)
          .run();
      } else if (a.action === "unsupport") {
        await db
          .prepare("DELETE FROM supports WHERE request_id=? AND user_id=?")
          .bind(r.id, u.id)
          .run();
      } else {
        if (!["published", "review", "restored"].includes(r.status))
          throw new HttpError(
            "Этот запрос сейчас недоступен для действий.",
            409,
          );
        if (a.action === "support")
          await db
            .prepare(
              "INSERT INTO supports (request_id,user_id,pledge,created_at) VALUES (?,?,?,?) ON CONFLICT(request_id,user_id) DO UPDATE SET pledge=excluded.pledge",
            )
            .bind(r.id, u.id, a.pledge, now)
            .run();
        if (a.action === "report")
          await db
            .prepare(
              "INSERT INTO reports (id,request_id,user_id,reason,detail,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id,request_id) DO UPDATE SET reason=excluded.reason,detail=excluded.detail,status='open'",
            )
            .bind(crypto.randomUUID(), r.id, u.id, a.reason, a.detail, now)
            .run();
      }
    } else {
      const offer = await db
        .prepare(
          "SELECT o.id,o.request_id FROM offers o WHERE o.id=? AND (o.request_id IS NULL OR EXISTS(SELECT 1 FROM requests r WHERE r.id=o.request_id AND r.status IN ('published','review','restored')))",
        )
        .bind(a.offerId)
        .first<{ id: string; request_id: string | null }>();
      if (!offer) throw new HttpError("Предложение не найдено.", 404);
      if (a.action === "choose") {
        if (!offer.request_id)
          throw new HttpError(
            "У этой идеи пока нет общего запроса для сравнения.",
          );
        await db
          .prepare(
            "INSERT INTO choices (user_id,request_id,offer_id,created_at) VALUES (?,?,?,?) ON CONFLICT(user_id,request_id) DO UPDATE SET offer_id=excluded.offer_id,created_at=excluded.created_at",
          )
          .bind(u.id, offer.request_id, offer.id, now)
          .run();
      } else if (a.action === "interest") {
        if (a.kind === "none")
          await db
            .prepare("DELETE FROM interests WHERE user_id=? AND offer_id=?")
            .bind(u.id, offer.id)
            .run();
        else
          await db
            .prepare(
              "INSERT INTO interests (user_id,offer_id,kind,created_at) VALUES (?,?,?,?) ON CONFLICT(user_id,offer_id) DO UPDATE SET kind=excluded.kind,created_at=excluded.created_at",
            )
            .bind(u.id, offer.id, a.kind, now)
            .run();
      }
    }
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
