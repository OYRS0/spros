import type { Demand, Point } from "./types";

export function distanceKm(a: Point, b: Point): number {
  const r = Math.PI / 180;
  const v =
    Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) *
      Math.cos(b.lat * r) *
      Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(v), Math.sqrt(1 - v));
}
export function nearbySimilar(
  requests: Demand[],
  point: Point,
  category: string,
  title: string,
) {
  const words = title
    .toLowerCase()
    .replace(/ё/g, "е")
    .split(/[^а-яa-z0-9]+/)
    .filter((w) => w.length > 3);
  return requests
    .filter(
      (r) =>
        ["published", "review", "restored"].includes(r.status) &&
        distanceKm(r, point) < 0.8 &&
        (r.category === category ||
          words.some((w) =>
            r.title.toLowerCase().replace(/ё/g, "е").includes(w.slice(0, 5)),
          )),
    )
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 3);
}
export type MapCluster = {
  lat: number;
  lng: number;
  items: Demand[];
  votes: number;
};
/** Spatial screen grid keeps nearby pins grouped without depending on a provider. */
export function clusterDemands(requests: Demand[], zoom: number): MapCluster[] {
  const world = 256 * 2 ** zoom;
  const cell = zoom >= 16 ? 28 : 80;
  const groups = new Map<string, MapCluster>();
  for (const item of requests) {
    const x = ((item.lng + 180) / 360) * world;
    const sin = Math.sin((item.lat * Math.PI) / 180);
    const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * world;
    const key = `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
    const group = groups.get(key) ?? { lat: 0, lng: 0, items: [], votes: 0 };
    group.items.push(item);
    group.lat += item.lat;
    group.lng += item.lng;
    group.votes += item.votes;
    groups.set(key, group);
  }
  return [...groups.values()].map((g) => ({
    ...g,
    lat: g.lat / g.items.length,
    lng: g.lng / g.items.length,
  }));
}
