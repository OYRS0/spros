"use client";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Plus,
  Minus,
  LocateFixed,
  Layers,
  MapPin,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { CategoryIcon } from "./category-icon";
import { clusterDemands, distanceKm } from "@/lib/domain/geo";
import { categoryById, formatNumber } from "@/lib/domain/catalog";
import type { Demand, Point } from "@/lib/domain/types";
import "leaflet/dist/leaflet.css";
import { mapConfig } from "@/lib/domain/map-config";
import { moveMapCamera } from "@/lib/map-camera";

export const initialCenter = { lat: 55.766, lng: 37.497 };
export function MapView({
  requests,
  onSelect,
  selectedId,
  center = initialCenter,
  selecting = false,
  onPoint,
  point,
  compact = false,
  kind = "demands",
}: {
  requests: Demand[];
  onSelect: (r: Demand) => void;
  selectedId?: string;
  center?: Point;
  selecting?: boolean;
  onPoint?: (p: Point) => void;
  point?: Point | null;
  compact?: boolean;
  kind?: "demands" | "offers";
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const library = useRef<typeof Leaflet | null>(null);
  const pins = useRef<Leaflet.LayerGroup | null>(null);
  const halos = useRef<Leaflet.LayerGroup | null>(null);
  const chosen = useRef<Leaflet.Marker | null>(null);
  const current = useRef({
    requests,
    onSelect,
    selectedId,
    selecting,
    onPoint,
    point,
  });
  current.current = {
    requests,
    onSelect,
    selectedId,
    selecting,
    onPoint,
    point,
  };
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(13);
  const [heat, setHeat] = useState(false);
  const [tileError, setTileError] = useState(false);
  useEffect(() => {
    let gone = false;
    let resize: ResizeObserver | undefined;
    import("leaflet")
      .then((mod) => {
        if (gone || !container.current) return;
        const L = mod.default ?? mod;
        library.current = L;
        const m = L.map(container.current, {
          zoomControl: false,
          attributionControl: true,
          minZoom: 5,
          maxZoom: 19,
        }).setView([center.lat, center.lng], compact ? 15 : 13);
        m.attributionControl.setPrefix(false);
        map.current = m;
        const tiles = L.tileLayer(mapConfig.tileUrl, {
          maxZoom: 19,
          attribution:
            '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
          crossOrigin: true,
        });
        let failed = 0;
        tiles.on("tileerror", () => {
          failed++;
          if (failed >= 3) setTileError(true);
        });
        tiles.on("tileload", () => setTileError(false));
        tiles.addTo(m);
        pins.current = L.layerGroup().addTo(m);
        halos.current = L.layerGroup().addTo(m);
        m.on("zoomend", () => setZoom(m.getZoom()));
        m.on("click", (e: Leaflet.LeafletMouseEvent) => {
          if (current.current.selecting)
            current.current.onPoint?.({ lat: e.latlng.lat, lng: e.latlng.lng });
        });
        resize = new ResizeObserver(() => {
          // A mobile list/map switch can hide the map during an animation.
          m.stop();
          m.invalidateSize({ pan: false });
        });
        resize.observe(container.current);
        setReady(true);
      })
      .catch(() => setTileError(true));
    return () => {
      gone = true;
      resize?.disconnect();
      map.current?.remove();
      map.current = null;
    };
    // The provider instance is created once; later view changes use flyTo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (ready && map.current)
      moveMapCamera(map.current, [center.lat, center.lng], compact ? 15 : 14);
  }, [center.lat, center.lng, ready, compact]);
  useEffect(() => {
    const L = library.current,
      m = map.current,
      layer = pins.current;
    if (!L || !m || !layer) return;
    layer.clearLayers();
    if (selecting) return;
    for (const c of clusterDemands(requests, zoom)) {
      const single = c.items.length === 1;
      const r = c.items[0];
      const active = c.items.some((i) => i.id === selectedId);
      const cat = categoryById(r.category);
      const icon = renderToStaticMarkup(
        <CategoryIcon id={r.category} size={17} />,
      );
      const value =
        kind === "offers"
          ? single
            ? "Бизнес"
            : String(c.items.length)
          : formatNumber(c.votes);
      const inner = `<span class="demand-pin ${active ? "active" : ""} ${single ? "" : "cluster"}" style="--pin-color:${cat.color}">${single ? icon : '<span class="cluster-dots">⋮</span>'}<strong>${value}</strong>${single || kind === "offers" ? "" : `<small>${c.items.length}</small>`}</span>`;
      const marker = L.marker([c.lat, c.lng], {
        icon: L.divIcon({
          html: inner,
          className: "pin-container",
          iconSize: [88, 44],
          iconAnchor: [44, 44],
        }),
        keyboard: true,
        title:
          kind === "offers"
            ? single
              ? r.title
              : `${c.items.length} концепции бизнеса`
            : single
              ? `${r.title}, ${r.votes} поддержали`
              : `${c.items.length} запросов, ${c.votes} голосов`,
        zIndexOffset: active ? 1000 : c.votes,
      });
      marker.on("click", () => {
        if (single) current.current.onSelect(r);
        else if (
          zoom >= 17 ||
          c.items.every((item) => distanceKm(item, c) < 0.025)
        ) {
          const list = document.createElement("div");
          list.className = "cluster-list";
          const heading = document.createElement("strong");
          heading.textContent =
            kind === "offers"
              ? "Предложения в этой точке"
              : "Запросы в этой точке";
          list.appendChild(heading);
          for (const item of c.items) {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent =
              kind === "offers"
                ? item.title
                : `${item.title} · ${formatNumber(item.votes)}`;
            button.addEventListener("click", () => {
              m.closePopup();
              current.current.onSelect(item);
            });
            list.appendChild(button);
          }
          L.popup({ className: "spros-cluster-popup", maxWidth: 320 })
            .setLatLng([c.lat, c.lng])
            .setContent(list)
            .openOn(m);
        } else
          m.fitBounds(L.latLngBounds(c.items.map((i) => [i.lat, i.lng])), {
            padding: [80, 80],
            maxZoom: Math.min(19, zoom + 2),
          });
      });
      if (single) {
        const label = document.createElement("span");
        label.textContent = r.title;
        marker.bindTooltip(label, {
          direction: "top",
          offset: [0, -38],
          className: "map-tooltip",
        });
      }
      marker.addTo(layer);
    }
  }, [requests, zoom, selectedId, ready, selecting, kind]);
  useEffect(() => {
    const L = library.current,
      layer = halos.current;
    if (!L || !layer) return;
    layer.clearLayers();
    if (!heat || selecting || kind === "offers") return;
    for (const r of requests.filter((r) => r.votes >= 150))
      L.circle([r.lat, r.lng], {
        radius: Math.max(150, Math.sqrt(r.votes) * 17),
        stroke: false,
        fillColor: "#db945c",
        fillOpacity: 0.17,
        interactive: false,
      }).addTo(layer);
  }, [heat, requests, ready, selecting, kind]);
  useEffect(() => {
    const L = library.current,
      m = map.current;
    if (!L || !m) return;
    chosen.current?.remove();
    if (point)
      chosen.current = L.marker([point.lat, point.lng], {
        icon: L.divIcon({
          html: '<span class="picked-pin"></span>',
          className: "",
          iconSize: [28, 38],
          iconAnchor: [14, 38],
        }),
      }).addTo(m);
  }, [point, ready]);
  function locate() {
    if (!navigator.geolocation) {
      toast.error("Геолокация недоступна. Выберите район в поиске.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if (map.current)
          moveMapCamera(map.current, [p.coords.latitude, p.coords.longitude], 14);
        if (selecting)
          onPoint?.({ lat: p.coords.latitude, lng: p.coords.longitude });
      },
      () =>
        toast.error(
          "Не удалось определить местоположение. Выберите точку на карте.",
        ),
      { timeout: 10000 },
    );
  }
  return (
    <div
      className={`map-wrap ${selecting ? "selecting-map" : ""} ${compact ? "compact-map" : ""}`}
    >
      <div
        ref={container}
        className="leaflet-map"
        aria-label={
          selecting
            ? "Выберите точку на карте"
            : "Карта запросов жителей Москвы"
        }
      />
      {!compact && (
        <div className="map-top-note">
          <span className="live-outline">
            <MapPin size={15} /> Москва
          </span>
          <span>
            {kind === "offers" ? "Предложения рядом" : "Запросы ваших соседей"}
          </span>
        </div>
      )}
      {selecting && (
        <div className="point-hint">
          <MapPin size={16} />
          Нажмите на карту, где нужен бизнес
        </div>
      )}
      {!compact && !selecting && kind === "demands" && (
        <div className="map-heat">
          <Layers size={17} />
          <label htmlFor="hot-zones">Горячие зоны</label>
          <Switch id="hot-zones" checked={heat} onCheckedChange={setHeat} />
        </div>
      )}
      <div className="map-controls">
        <button
          aria-label="Приблизить карту"
          onClick={() => map.current?.zoomIn()}
        >
          <Plus size={21} />
        </button>
        <button
          aria-label="Отдалить карту"
          onClick={() => map.current?.zoomOut()}
        >
          <Minus size={21} />
        </button>
        <button
          className="locate-button"
          aria-label="Моё местоположение"
          onClick={locate}
        >
          <LocateFixed size={21} />
        </button>
      </div>
      {!compact && !selecting && (
        <div className="map-bottom-note">
          <span className="mini-mark">S</span>
          <div>
            <b>Здесь начинается что-то нужное</b>
            <span>Каждый запрос — повод открыть бизнес рядом.</span>
          </div>
          <ArrowUpRight size={20} />
        </div>
      )}
      {tileError && (
        <div className="map-error" role="status">
          Подложка карты недоступна. Запросы доступны в списке.{" "}
          <button onClick={() => window.location.reload()}>Повторить</button>
        </div>
      )}
    </div>
  );
}
