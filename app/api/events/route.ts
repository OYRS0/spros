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
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const p = z
      .object({
        session: z.string().uuid(),
        event: z.enum([
          "map_view",
          "request_view",
          "signin_start",
          "signin_complete",
        ]),
        entity: z.string().max(100),
      })
      .strict()
      .parse(await readBody(request));
    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
    const bytes = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${Math.floor(Date.now() / 86400000)}:${ip}`),
    );
    const bucket = Array.from(new Uint8Array(bytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    await rateLimit(bucket, "analytics", 500);
    const u = p.event === "signin_complete" ? await identity(true) : null;
    if (
      p.entity &&
      p.event === "request_view" &&
      !(await database()
        .prepare(
          "SELECT id FROM requests WHERE id=? AND status IN ('published','review','restored')",
        )
        .bind(p.entity)
        .first())
    )
      throw new HttpError("Запрос не найден", 404);
    await database()
      .prepare(
        "INSERT OR IGNORE INTO pilot_events (session,event,entity,user_id,created_at) VALUES (?,?,?,?,?)",
      )
      .bind(p.session, p.event, p.entity, u?.id ?? null, Date.now())
      .run();
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
