import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("wrangler/package.json"))("esbuild");
const output = resolve(".sites-runtime/map-camera.mjs");
await build({ entryPoints: ["lib/map-camera.ts"], outfile: output, bundle: true, platform: "node", format: "esm" });
const { moveMapCamera } = await import(pathToFileURL(output));

// Run the installed Leaflet flyTo implementation against a zero-size viewport.
const source = readFileSync(require.resolve("leaflet"), "utf8");
const start = source.indexOf("flyTo: function (targetCenter, targetZoom, options) {");
const end = start + source.slice(start).search(/^\s*\},\r?$/m);
const body = source.slice(source.indexOf("{", start) + 1, end);
const flyTo = new Function("Browser", "toLatLng", "requestAnimFrame", `return function(targetCenter,targetZoom,options){${body}}`)(
  { any3d: true }, (v) => v, () => 1,
);
const point = (x) => ({ x, distanceTo: (p) => Math.abs(x - p.x), add: (p) => point(x + p.x), subtract: (p) => point(x - p.x), multiplyBy: (n) => point(x * n) });
const legacy = {
  _zoom: 13, _stop() {}, _moveStart() {}, getCenter: () => [0, 0],
  project: () => point(0), getSize: () => ({ x: 0, y: 0 }), getZoomScale: () => 0.5,
  unproject(p) { assert.ok(Number.isFinite(p.x), "Invalid map coordinates"); return [0, 0]; },
  getScaleZoom: () => 14, _move() { return this; }, _moveEnd() {},
};
assert.throws(() => flyTo.call(legacy, [0, 0], 14, { duration: 0.65 }), /Invalid map coordinates/);

for (const size of [{ x: 0, y: 0 }, { x: 0, y: 400 }, { x: 400, y: 0 }, { x: 390, y: 600 }]) {
  const calls = [];
  const map = {
    stop: () => calls.push("stop"), invalidateSize: () => calls.push("resize"), getSize: () => size,
    setView: (_center, _zoom, options) => { assert.equal(options.animate, false); calls.push("static"); },
    flyTo: () => calls.push("animated"),
  };
  moveMapCamera(map, [55.766, 37.497], 14);
  assert.deepEqual(calls, ["stop", "resize", size.x && size.y ? "animated" : "static"]);
}
console.log("Map regression: reproduced Leaflet hidden-map crash; 4 camera cases passed.");
