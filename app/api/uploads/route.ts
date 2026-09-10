import { database, bucket } from "@/lib/server/database";
import {
  checkOrigin,
  errorResponse,
  HttpError,
  identity,
  rateLimit,
} from "@/lib/server/security";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = (await identity(true))!;
    if (Number(request.headers.get("content-length")) > 5500000)
      throw new HttpError("Изображение должно быть меньше 5 МБ.", 413);
    await rateLimit(user.id, "upload", 10, 86400);
    // Enforce the limit even when the client omits Content-Length.
    const reader = request.body?.getReader();
    if (!reader) throw new HttpError("Файл не получен.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 5500000) {
        await reader.cancel();
        throw new HttpError("Изображение должно быть меньше 5 МБ.", 413);
      }
      chunks.push(value);
    }
    const payload = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      payload.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const form = await new Response(payload, {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    }).formData();
    const file = form.get("file");
    if (
      !file ||
      typeof file === "string" ||
      !file.size ||
      file.size > 5 * 1024 * 1024
    )
      throw new HttpError("Выберите JPG, PNG или WebP до 5 МБ.", 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    let mime = "";
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
      mime = "image/jpeg";
    if (
      bytes[0] === 0x89 &&
      String.fromCharCode(...bytes.slice(1, 4)) === "PNG"
    )
      mime = "image/png";
    if (
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    )
      mime = "image/webp";
    if (!mime)
      throw new HttpError("Поддерживаются только JPG, PNG и WebP.", 400);
    const id = crypto.randomUUID();
    await bucket().put(id, bytes, { httpMetadata: { contentType: mime } });
    try {
      await database()
        .prepare(
          "INSERT INTO media (id,owner_id,mime,size,created_at) VALUES (?,?,?,?,?)",
        )
        .bind(id, user.id, mime, file.size, Date.now())
        .run();
    } catch (e) {
      await bucket().delete(id);
      throw e;
    }
    return Response.json({ id, url: `/api/media/${id}` }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
