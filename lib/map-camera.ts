import type { Map as LeafletMap, LatLngExpression } from "leaflet";

/** Leaflet flyTo divides by viewport size; a CSS-hidden map must not animate. */
export function moveMapCamera(
  map: Pick<LeafletMap, "stop" | "invalidateSize" | "getSize" | "flyTo" | "setView">,
  center: LatLngExpression,
  zoom: number,
) {
  map.stop();
  map.invalidateSize({ pan: false });
  const size = map.getSize();
  if (size.x <= 0 || size.y <= 0) {
    map.setView(center, zoom, { animate: false });
    return;
  }
  map.flyTo(center, zoom, { duration: 0.65 });
}
