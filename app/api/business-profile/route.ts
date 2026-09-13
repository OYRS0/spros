import { z } from "zod";
import { database } from "@/lib/server/database";
import {
  checkOrigin,
  errorResponse,
  readBody,
  rateLimit,
  identity,
} from "@/lib/server/security";
export async function GET() {
  try {
    const u = (await identity(true))!;
    return Response.json(
      {
        business: await database()
          .prepare("SELECT * FROM business_profiles WHERE user_id=?")
          .bind(u.id)
          .first(),
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
    await rateLimit(u.id, "business-profile", 10);
    const p = z
      .object({
        legalName: z.string().trim().min(3).max(200),
        inn: z.string().regex(/^(\d{10}|\d{12})$/),
        contact: z.string().trim().min(5).max(200),
        about: z.string().trim().min(20).max(2000),
      })
      .strict()
      .parse(await readBody(request));
    await database()
      .prepare(
        "INSERT INTO business_profiles (user_id,legal_name,inn,contact,about,status,updated_at) VALUES (?,?,?,?,?,'pending',?) ON CONFLICT(user_id) DO UPDATE SET legal_name=excluded.legal_name,inn=excluded.inn,contact=excluded.contact,about=excluded.about,status='pending',reason=NULL,updated_at=excluded.updated_at",
      )
      .bind(u.id, p.legalName, p.inn, p.contact, p.about, Date.now())
      .run();
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
