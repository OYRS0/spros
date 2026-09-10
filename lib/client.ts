export async function api<T = Record<string, unknown>>(
  url: string,
  body?: unknown,
): Promise<T> {
  const r = await fetch(
    url,
    body === undefined
      ? { cache: "no-store" }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const json = (await r.json()) as T & { error?: string };
  if (!r.ok)
    throw new Error(
      json.error ?? "Не удалось выполнить действие. Попробуйте ещё раз.",
    );
  return json;
}
