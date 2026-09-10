import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

// Exercises the actual built Worker with isolated, disposable D1 and R2.
// Test identities exist only in this local emulator, never in the deployed app.
const require = createRequire(import.meta.url);
const runtimeRequire = createRequire(require.resolve("wrangler/package.json"));
const { Miniflare, Log, LogLevel } = runtimeRequire("miniflare");
const root = resolve(import.meta.dirname, "..");
const config = JSON.parse(
  await readFile(resolve(root, "dist/server/wrangler.json"), "utf8"),
);
const serverRoot = resolve(root, "dist/server");
const modulePaths = (await readdir(serverRoot, { recursive: true })).filter(
  (p) => /\.m?js$/.test(p),
);
modulePaths.sort((a, b) =>
  a === "index.js" ? -1 : b === "index.js" ? 1 : a.localeCompare(b),
);
const mf = new Miniflare({
  modules: modulePaths.map((p) => ({
    type: "ESModule",
    path: resolve(serverRoot, p),
  })),
  modulesRoot: serverRoot,
  compatibilityDate: config.compatibility_date,
  compatibilityFlags: config.compatibility_flags,
  d1Databases: { DB: "test-spros" },
  r2Buckets: ["BUCKET"],
  bindings: { SPROS_MODERATOR_IDS: "qa-moderator" },
  log: new Log(LogLevel.ERROR),
  cf: false,
});
let checks = 0;
async function call(
  path,
  { user = "qa-resident", body, expected = 200, headers = {} } = {},
) {
  const r = await mf.dispatchFetch(`http://spros.test${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(user
        ? {
            "oai-authenticated-user-id": user,
            "oai-authenticated-user-email": `${user}@example.test`,
          }
        : {}),
      ...(body === undefined
        ? {}
        : { "Content-Type": "application/json", Origin: "http://spros.test" }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await r.text();
  assert.equal(r.status, expected, `${path}: ${raw.slice(0, 700)}`);
  checks++;
  return r.headers.get("content-type")?.includes("application/json")
    ? JSON.parse(raw)
    : raw;
}
try {
  const db = await mf.getD1Database("DB");
  for (const name of (await readdir(resolve(root, "drizzle")))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(resolve(root, "drizzle", name), "utf8");
    for (const statement of sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean))
      await db.prepare(statement).run();
  }
  const initial = await call("/api/requests", { user: null });
  assert.equal(initial.requests.length, 14);
  assert.equal(initial.offers.length, 3);
  assert(initial.requests.every((r) => r.isDemo));
  const html = await call("/", { user: null });
  assert.match(html, /Чего не хватает/);
  assert.match(html, /Пилот SPROS/);
  assert(!html.includes("Your site is taking shape"));
  await call("/api/actions", {
    user: null,
    body: { action: "support", requestId: "d1", pledge: 0 },
    expected: 401,
  });
  await call("/api/actions", {
    body: { action: "support", requestId: "d1", pledge: 1000 },
  });
  await call("/api/actions", {
    body: { action: "support", requestId: "d1", pledge: 5000 },
  });
  let data = await call("/api/requests");
  let restaurant = data.requests.find((r) => r.id === "d1");
  assert.equal(restaurant.votes, 648);
  assert.equal(restaurant.pledgers, 94);
  assert.equal(restaurant.myPledge, 5000);
  assert.equal(restaurant.pledgeTotal, 284000);
  await call("/api/actions", {
    user: "qa-neighbor",
    body: { action: "support", requestId: "d1", pledge: 0 },
  });
  data = await call("/api/requests");
  assert.equal(data.requests.find((r) => r.id === "d1").votes, 649);
  await call("/api/actions", {
    body: { action: "support", requestId: "d1", pledge: -1000 },
    expected: 400,
  });
  await call("/api/actions", {
    body: { action: "support", requestId: "d1", pledge: 0 },
    headers: { Origin: "https://evil.test" },
    expected: 403,
  });
  await call("/api/actions", {
    body: {
      action: "report",
      requestId: "d1",
      reason: "Проверка спама",
      detail: "Тестовая жалоба",
    },
  });
  data = await call("/api/requests");
  assert.equal(data.requests.find((r) => r.id === "d1").status, "published");
  const newRequest = {
    title: "Семейное бистро рядом",
    category: "food",
    location: "Сердце столицы",
    district: "Хорошёво-Мнёвники",
    lat: 55.7652,
    lng: 37.509,
    description: "Небольшое место с детским меню и завтраками",
    needs: ["Завтраки"],
    avgCheck: 1500,
    pledge: 1000,
  };
  await call("/api/requests", { body: newRequest, expected: 409 });
  const created = await call("/api/requests", {
    body: { ...newRequest, confirmedDistinct: true },
    expected: 201,
  });
  data = await call("/api/requests");
  assert.equal(data.requests.find((r) => r.id === created.id).votes, 1);
  await call("/api/actions", {
    user: "qa-neighbor",
    body: { action: "support", requestId: created.id, pledge: 0 },
  });
  await call("/api/moderation", { expected: 403 });
  await call("/api/moderation", {
    user: "qa-moderator",
    body: {
      requestId: created.id,
      status: "hidden",
      reason: "Спам: тестовый сценарий проверки модерации",
    },
  });
  data = await call("/api/requests", { user: "qa-neighbor" });
  assert(!data.requests.some((r) => r.id === created.id));
  const neighborAccount = await call("/api/profile", { user: "qa-neighbor" });
  assert(!neighborAccount.requests.some((r) => r.id === created.id));
  let account = await call("/api/profile");
  assert.equal(
    account.requests.find((r) => r.id === created.id).status,
    "hidden",
  );
  await call("/api/actions", {
    user: "qa-neighbor",
    body: {
      action: "appeal",
      requestId: created.id,
      text: "Это чужой запрос, право на апелляцию отсутствует.",
    },
    expected: 403,
  });
  await call("/api/actions", {
    body: {
      action: "appeal",
      requestId: created.id,
      text: "Запрос отличается от соседнего форматом и временем работы.",
    },
  });
  await call("/api/moderation", {
    user: "qa-moderator",
    body: {
      requestId: created.id,
      status: "restored",
      reason: "Апелляция удовлетворена: нарушение не установлено",
    },
  });
  account = await call("/api/profile");
  assert.equal(account.appeals[0].status, "accepted");
  assert.equal(account.events.length, 2);
  await call("/api/actions", { body: { action: "choose", offerId: "o1" } });
  await call("/api/actions", { body: { action: "choose", offerId: "o2" } });
  data = await call("/api/requests");
  assert.equal(data.offers.find((o) => o.id === "o1").choices, 0);
  assert.equal(data.offers.find((o) => o.id === "o2").choices, 1);
  account = await call("/api/profile");
  assert(account.offers.some((o) => o.id === "o2" && o.chosen));
  await call("/api/actions", {
    body: { action: "interest", offerId: "o3", kind: "certificate" },
  });
  account = await call("/api/profile");
  assert(
    account.offers.some((o) => o.id === "o3" && o.interest === "certificate"),
  );
  await call("/api/moderation", {
    user: "qa-moderator",
    body: {
      requestId: created.id,
      status: "merged",
      targetId: "d1",
      reason: "Запросы об одном формате в одном месте объединены",
    },
  });
  data = await call("/api/requests");
  restaurant = data.requests.find((r) => r.id === "d1");
  assert.equal(restaurant.votes, 649);
  assert.equal(restaurant.myPledge, 5000);
  const offerBody = {
    requestId: null,
    title: "Тестовая кофейня",
    category: "coffee",
    location: "Береговой",
    lat: 55.756,
    lng: 37.502,
    description: "Кофейня на двадцать мест, команда с опытом, помещение ищем.",
    budget: 3000000,
    fundingNeeded: 1000000,
    timeline: "Четыре месяца",
    benefit: "Кофе в подарок первым посетителям",
    avgCheck: 500,
    photoKey: null,
  };
  const offer = await call("/api/offers", { body: offerBody, expected: 201 });
  data = await call("/api/requests");
  assert(data.offers.some((o) => o.id === offer.id));
  await call("/api/offers", {
    body: { ...offerBody, fundingNeeded: 4000000 },
    expected: 400,
  });
  // Two remaining requests today, then the atomic server limit rejects the fourth.
  const distinct = {
    ...newRequest,
    category: "other",
    lat: 55.9,
    lng: 37.8,
    confirmedDistinct: true,
  };
  await call("/api/requests", {
    body: { ...distinct, title: "Мастерская для соседей" },
    expected: 201,
  });
  await call("/api/requests", {
    body: { ...distinct, title: "Клуб книг и встреч" },
    expected: 201,
  });
  await call("/api/requests", {
    body: { ...distinct, title: "Четвёртый запрос за день" },
    expected: 429,
  });
  const foreignKeys = await db.prepare("PRAGMA foreign_key_check").all();
  assert.equal(foreignKeys.results.length, 0);
  // Image uploads have real ownership and MIME boundaries.
  const imageBody = new FormData();
  imageBody.append(
    "file",
    new File(
      [
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9S0AAAAASUVORK5CYII=",
          "base64",
        ),
      ],
      "test.png",
      { type: "image/png" },
    ),
  );
  const imageRequest = new Request("http://spros.test/api/uploads", {
    method: "POST",
    body: imageBody,
  });
  const imagePayload = new Uint8Array(await imageRequest.arrayBuffer());
  const imageResponse = await mf.dispatchFetch(
    "http://spros.test/api/uploads",
    {
      method: "POST",
      headers: {
        "oai-authenticated-user-id": "qa-resident",
        "oai-authenticated-user-email": "qa-resident@example.test",
        Origin: "http://spros.test",
        "Content-Type": imageRequest.headers.get("content-type"),
      },
      body: imagePayload,
    },
  );
  assert.equal(imageResponse.status, 201);
  checks++;
  const image = await imageResponse.json();
  await call(`/api/media/${image.id}`, { user: "qa-neighbor", expected: 404 });
  await call("/api/offers", {
    user: "qa-neighbor",
    body: { ...offerBody, photoKey: image.id },
    expected: 403,
  });
  await call("/api/offers", {
    body: { ...offerBody, photoKey: image.id },
    expected: 201,
  });
  const visibleImage = await mf.dispatchFetch(
    `http://spros.test/api/media/${image.id}`,
  );
  assert.equal(visibleImage.status, 200);
  assert.equal(visibleImage.headers.get("content-type"), "image/png");
  checks++;
  const svgBody = new FormData();
  svgBody.append(
    "file",
    new File(["<svg onload='alert(1)'></svg>"], "bad.svg", {
      type: "image/svg+xml",
    }),
  );
  const badRequest = new Request("http://spros.test/api/uploads", {
    method: "POST",
    body: svgBody,
  });
  const badPayload = new Uint8Array(await badRequest.arrayBuffer());
  const badImage = await mf.dispatchFetch("http://spros.test/api/uploads", {
    method: "POST",
    headers: {
      "oai-authenticated-user-id": "qa-resident",
      "oai-authenticated-user-email": "qa-resident@example.test",
      Origin: "http://spros.test",
      "Content-Type": badRequest.headers.get("content-type"),
    },
    body: badPayload,
  });
  assert.equal(badImage.status, 400);
  checks++;
  console.log(
    `PASS: ${checks} Worker requests; SSR, auth, votes, pledges, duplicates, reports, appeals, merge deduplication, offers, concept choice, interest, rate limits, foreign keys.`,
  );
} finally {
  await mf.dispose();
}
