import { z } from "zod";
import { database } from "@/lib/server/database";
import {
  checkOrigin,
  errorResponse,
  HttpError,
  identity,
  readBody,
  rateLimit,
} from "@/lib/server/security";
import { canTransition } from "@/lib/domain/moderation";
import type { ModerationStatus } from "@/lib/domain/types";
export async function GET() {
  try {
    const u = (await identity(true))!;
    if (!u.moderator)
      throw new HttpError("Доступ только для назначенного модератора.", 403);
    const db = database();
    const [requests, reports, appeals] = await Promise.all([
      db
        .prepare(
          "SELECT id,title,category,location,status,reason,owner_id FROM requests ORDER BY created_at DESC LIMIT 500",
        )
        .all(),
      db
        .prepare(
          "SELECT id,request_id,reason,detail,status,created_at FROM reports WHERE status='open' ORDER BY created_at DESC LIMIT 200",
        )
        .all(),
      db
        .prepare(
          "SELECT id,request_id,text,status,created_at FROM appeals WHERE status='open' ORDER BY created_at DESC LIMIT 200",
        )
        .all(),
    ]);
    return Response.json(
      {
        requests: requests.results,
        reports: reports.results,
        appeals: appeals.results,
      },
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
    if (!u.moderator)
      throw new HttpError("Доступ только для назначенного модератора.", 403);
    await rateLimit(u.id, "moderate", 100);
    const body = await readBody(request);
    if (body?.action === "reject_appeal") {
      const rejection = z
        .object({
          appealId: z.string().min(1).max(100),
          reason: z.string().trim().min(10).max(1000),
        })
        .parse(body);
      const db = database();
      const appeal = await db
        .prepare("SELECT request_id FROM appeals WHERE id=? AND status='open'")
        .bind(rejection.appealId)
        .first<{ request_id: string }>();
      if (!appeal)
        throw new HttpError("Апелляция уже рассмотрена или не найдена.", 409);
      await db.batch([
        db
          .prepare(
            "UPDATE appeals SET status='rejected',resolution=? WHERE id=? AND status='open'",
          )
          .bind(rejection.reason, rejection.appealId),
        db
          .prepare(
            "INSERT INTO moderation_events (id,request_id,actor_id,from_status,to_status,reason,created_at) VALUES (?,?,?,?,?,?,?)",
          )
          .bind(
            crypto.randomUUID(),
            appeal.request_id,
            u.id,
            "hidden",
            "hidden",
            `Апелляция отклонена: ${rejection.reason}`,
            Date.now(),
          ),
      ]);
      return Response.json({ ok: true });
    }
    const a = z
      .object({
        requestId: z.string().max(100),
        status: z.enum(["published", "review", "hidden", "merged", "restored"]),
        reason: z.string().trim().min(10).max(1000),
        targetId: z.string().max(100).optional(),
      })
      .parse(body);
    const db = database();
    const r = await db
      .prepare("SELECT id,status FROM requests WHERE id=?")
      .bind(a.requestId)
      .first<{ id: string; status: ModerationStatus }>();
    if (!r) throw new HttpError("Запрос не найден.", 404);
    if (!canTransition(r.status, a.status))
      throw new HttpError("Этот переход статуса недоступен.", 409);
    const changes: D1PreparedStatement[] = [];
    if (a.status === "merged") {
      if (!a.targetId || a.targetId === r.id)
        throw new HttpError("Выберите другой запрос для объединения.");
      const target = await db
        .prepare(
          "SELECT id FROM requests WHERE id=? AND status IN ('published','review','restored')",
        )
        .bind(a.targetId)
        .first();
      if (!target) throw new HttpError("Целевой запрос недоступен.", 409);
      changes.push(
        db
          .prepare(
            "INSERT INTO supports (request_id,user_id,pledge,created_at) SELECT ?,user_id,pledge,created_at FROM supports WHERE request_id=? ON CONFLICT(request_id,user_id) DO UPDATE SET pledge=MAX(supports.pledge,excluded.pledge)",
          )
          .bind(a.targetId, r.id),
      );
      changes.push(
        db.prepare("DELETE FROM supports WHERE request_id=?").bind(r.id),
      );
      changes.push(
        db
          .prepare("UPDATE offers SET request_id=? WHERE request_id=?")
          .bind(a.targetId, r.id),
      );
      changes.push(
        db
          .prepare(
            "INSERT OR IGNORE INTO choices (user_id,request_id,offer_id,created_at) SELECT user_id,?,offer_id,created_at FROM choices WHERE request_id=?",
          )
          .bind(a.targetId, r.id),
      );
      changes.push(
        db.prepare("DELETE FROM choices WHERE request_id=?").bind(r.id),
      );
    }
    changes.push(
      db
        .prepare(
          "UPDATE requests SET status=?,reason=?,merged_into=? WHERE id=?",
        )
        .bind(
          a.status,
          a.reason,
          a.status === "merged" ? a.targetId : null,
          r.id,
        ),
    );
    changes.push(
      db
        .prepare(
          "INSERT INTO moderation_events (id,request_id,actor_id,from_status,to_status,reason,created_at) VALUES (?,?,?,?,?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
          r.id,
          u.id,
          r.status,
          a.status,
          a.reason,
          Date.now(),
        ),
    );
    if (a.status !== "review")
      changes.push(
        db
          .prepare("UPDATE reports SET status='resolved' WHERE request_id=?")
          .bind(r.id),
      );
    if (a.status === "restored")
      changes.push(
        db
          .prepare(
            "UPDATE appeals SET status='accepted',resolution=? WHERE request_id=? AND status='open'",
          )
          .bind(a.reason, r.id),
      );
    await db.batch(changes);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
