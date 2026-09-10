import { getChatGPTUser } from "@/app/chatgpt-auth";
import { database } from "./database";
import { env } from "cloudflare:workers";
import type { Profile } from "@/lib/domain/types";
export class HttpError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function identity(required = false): Promise<Profile | null> {
  const auth = await getChatGPTUser();
  if (!auth) {
    if (required)
      throw new HttpError("Войдите в аккаунт, чтобы продолжить.", 401);
    return null;
  }
  const db = database();
  await db
    .prepare(
      "INSERT INTO users (id,name,created_at) VALUES (?,?,?) ON CONFLICT(id) DO NOTHING",
    )
    .bind(auth.userId, auth.fullName ?? "Участник пилота", Date.now())
    .run();
  const row = await db
    .prepare("SELECT * FROM users WHERE id=?")
    .bind(auth.userId)
    .first<{
      id: string;
      name: string;
      district: string;
      phone_verified_at: number | null;
      residency_verified_at: number | null;
      suspended: number;
    }>();
  if (!row || row.suspended)
    throw new HttpError(
      "Действия аккаунта временно ограничены. Обратитесь к организатору пилота.",
      403,
    );
  const ids = (
    (env as unknown as Record<string, string>).SPROS_MODERATOR_IDS ?? ""
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    id: row.id,
    name: row.name,
    district: row.district,
    phoneVerified: !!row.phone_verified_at,
    residencyVerified: !!row.residency_verified_at,
    moderator: ids.includes(row.id),
  };
}
export function checkOrigin(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site")
    throw new HttpError("Запрос с другого сайта отклонён.", 403);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new HttpError("Недопустимый источник запроса.", 403);
}
export async function rateLimit(
  userId: string,
  action: string,
  max: number,
  seconds = 3600,
) {
  const now = Date.now();
  const window = Math.floor(now / (seconds * 1000));
  const key = `${userId}:${action}:${window}`;
  const result = await database()
    .prepare(
      "INSERT INTO action_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count < ? RETURNING count",
    )
    .bind(key, (window + 1) * seconds * 1000, max)
    .first();
  if (!result)
    throw new HttpError(
      "Слишком много действий. Попробуйте позже: лимит защищает карту от накрутки.",
      429,
    );
}
export async function readBody(request: Request) {
  const raw = await request.text();
  if (raw.length > 20000) throw new HttpError("Слишком большой запрос.", 413);
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError("Не удалось прочитать форму.", 400);
  }
}
export function errorResponse(error: unknown) {
  if (error instanceof HttpError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error && typeof error === "object" && "issues" in error)
    return Response.json(
      {
        error: "Проверьте заполнение полей: название, описание, место и суммы.",
      },
      { status: 400 },
    );
  console.error(
    "SPROS operation failed",
    error instanceof Error ? error.message : "unknown error",
  );
  return Response.json(
    { error: "Не удалось сохранить или загрузить данные. Попробуйте ещё раз." },
    { status: 503 },
  );
}
