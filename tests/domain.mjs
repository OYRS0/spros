import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const require = createRequire(import.meta.url);
const buildRequire = createRequire(require.resolve("wrangler/package.json"));
const { build } = buildRequire("esbuild");
const root = resolve(import.meta.dirname, "..");
const output = resolve(root, ".sites-runtime/domain-tests");
await build({
  entryPoints: [
    resolve(root, "lib/domain/geo.ts"),
    resolve(root, "lib/domain/validation.ts"),
    resolve(root, "lib/domain/moderation.ts"),
  ],
  outdir: output,
  bundle: true,
  platform: "node",
  format: "esm",
  outExtension: { ".js": ".mjs" },
  logLevel: "silent",
});
const geo = await import(pathToFileURL(resolve(output, "geo.mjs")));
const { requestSchema } = await import(
  pathToFileURL(resolve(output, "validation.mjs"))
);
const { canTransition } = await import(
  pathToFileURL(resolve(output, "moderation.mjs"))
);
const a = {
  id: "a",
  lat: 55.76,
  lng: 37.5,
  category: "coffee",
  title: "Кофейня",
  status: "published",
  votes: 80,
};
const b = { ...a, id: "b", lat: 55.7608, lng: 37.501, votes: 50 };
assert.equal(geo.distanceKm(a, a), 0);
assert(geo.distanceKm(a, b) > 0.08 && geo.distanceKm(a, b) < 0.13);
assert.equal(geo.nearbySimilar([a, b], a, "coffee", "Хороший кофе").length, 2);
assert.equal(
  geo.nearbySimilar([a], { lat: 55.8, lng: 37.6 }, "coffee", "Кофейня").length,
  0,
);
assert.equal(
  geo.nearbySimilar([{ ...a, status: "hidden" }], a, "coffee", "Кофейня")
    .length,
  0,
);
assert.equal(geo.clusterDemands([a, b], 10).length, 1);
assert.equal(geo.clusterDemands([a, b], 10)[0].votes, 130);
assert.equal(geo.clusterDemands([a, b], 18).length, 2);
assert(canTransition("hidden", "restored"));
assert(!canTransition("hidden", "published"));
assert(!canTransition("merged", "published"));
const valid = {
  title: "Кофейня рядом",
  category: "coffee",
  location: "Береговой",
  district: "Филёвский Парк",
  lat: 55.76,
  lng: 37.5,
  description: "Небольшая кофейня с ранними завтраками",
  needs: [],
  avgCheck: 500,
  pledge: 0,
};
assert(requestSchema.safeParse(valid).success);
assert(!requestSchema.safeParse({ ...valid, pledge: 999999 }).success);
assert(!requestSchema.safeParse({ ...valid, lat: NaN }).success);
assert(
  !requestSchema.safeParse({ ...valid, title: " ", avgCheck: -10 }).success,
);
console.log(
  "PASS: 15 domain assertions; distance, duplicate radius/status, clusters, transitions, input boundaries.",
);
