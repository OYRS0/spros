import { database, bucket } from "@/lib/server/database";
import { identity, errorResponse } from "@/lib/server/security";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const u = await identity();
    const record = await database()
      .prepare(
        "SELECT m.id FROM media m WHERE m.id=? AND (m.owner_id=? OR EXISTS(SELECT 1 FROM offers o WHERE o.photo_key=m.id AND (o.request_id IS NULL OR EXISTS(SELECT 1 FROM requests r WHERE r.id=o.request_id AND r.status IN ('published','review','restored')))))",
      )
      .bind(id, u?.id ?? "")
      .first();
    if (!record) return new Response("Изображение не найдено", { status: 404 });
    const file = await bucket().get(id);
    if (!file) return new Response("Изображение не найдено", { status: 404 });
    return new Response(file.body, {
      headers: {
        "Content-Type":
          file.httpMetadata?.contentType ?? "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
