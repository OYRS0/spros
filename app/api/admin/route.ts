import { z } from "zod";
import { database } from "@/lib/server/database";
import {
  checkOrigin,
  errorResponse,
  readBody,
  rateLimit,
  identity,
  HttpError,
} from "@/lib/server/security";
async function moderator() {
  const u = (await identity(true))!;
  if (!u.moderator)
    throw new HttpError("Доступ только для назначенного администратора.", 403);
  return u;
}
export async function GET() {
  try {
    await moderator();
    const db = database();
    const since = Date.now() - 30 * 86400000;
    const [requests, users, business, events, funnel, counts] =
      await Promise.all([
        db
          .prepare(
            "SELECT r.id,r.title,r.location,r.category,r.status,r.is_demo,r.owner_id,(SELECT COUNT(*) FROM supports s WHERE s.request_id=r.id) AS votes FROM requests r ORDER BY r.created_at DESC LIMIT 500",
          )
          .all(),
        db
          .prepare(
            "SELECT u.id,u.name,u.district,u.suspended,u.phone_verified_at,u.created_at,(SELECT COUNT(*) FROM requests r WHERE r.owner_id=u.id) AS requests,(SELECT COUNT(*) FROM supports s WHERE s.user_id=u.id) AS votes FROM users u ORDER BY u.created_at DESC LIMIT 200",
          )
          .all(),
        db
          .prepare(
            "SELECT b.*,u.name FROM business_profiles b JOIN users u ON u.id=b.user_id ORDER BY b.updated_at DESC LIMIT 200",
          )
          .all(),
        db
          .prepare(
            "SELECT a.*,u.name FROM admin_events a JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 100",
          )
          .all(),
        db
          .prepare(
            "SELECT event,COUNT(DISTINCT session) AS sessions FROM pilot_events WHERE created_at>=? GROUP BY event",
          )
          .bind(since)
          .all(),
        db
          .prepare(
            "SELECT (SELECT COUNT(*) FROM users) AS users,(SELECT COUNT(*) FROM requests WHERE is_demo=0) AS live_requests,(SELECT COUNT(*) FROM requests WHERE is_demo=1) AS demo_requests,(SELECT COUNT(DISTINCT s.user_id) FROM supports s JOIN requests r ON r.id=s.request_id WHERE r.is_demo=0 AND s.created_at>=?) AS supporters,(SELECT COUNT(*) FROM reports WHERE status='open') AS reports,(SELECT COUNT(*) FROM appeals WHERE status='open') AS appeals",
          )
          .bind(since)
          .first(),
      ]);
    return Response.json(
      {
        requests: requests.results,
        users: users.results,
        business: business.results,
        events: events.results,
        funnel: funnel.results,
        counts,
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
    const u = await moderator();
    await rateLimit(u.id, "admin", 50);
    const p = z
      .object({
        action: z.enum([
          "verify_business",
          "reject_business",
          "suspend",
          "restore",
        ]),
        target: z.string().min(1).max(200),
        reason: z.string().trim().min(10).max(1000),
      })
      .strict()
      .parse(await readBody(request));
    const db = database();
    const business = p.action.endsWith("business");
    if (!business && p.target === u.id)
      throw new HttpError("Нельзя ограничить собственный аккаунт.");
    if (
      !(await db
        .prepare(
          business
            ? "SELECT user_id FROM business_profiles WHERE user_id=?"
            : "SELECT id FROM users WHERE id=?",
        )
        .bind(p.target)
        .first())
    )
      throw new HttpError("Запись не найдена", 404);
    await db.batch([
      business
        ? db
            .prepare(
              "UPDATE business_profiles SET status=?,reason=?,updated_at=? WHERE user_id=?",
            )
            .bind(
              p.action === "verify_business" ? "verified" : "rejected",
              p.reason,
              Date.now(),
              p.target,
            )
        : db
            .prepare("UPDATE users SET suspended=? WHERE id=?")
            .bind(p.action === "suspend" ? 1 : 0, p.target),
      db
        .prepare(
          "INSERT INTO admin_events (id,actor_id,target,action,reason,created_at) VALUES (?,?,?,?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
          u.id,
          p.target,
          p.action,
          p.reason,
          Date.now(),
        ),
    ]);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
