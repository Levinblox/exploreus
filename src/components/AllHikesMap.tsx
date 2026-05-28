"use client";

import { useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Layer, Map, type MapMouseEvent, type MapRef, Source } from "react-map-gl/mapbox";
import type { Hike } from "@/lib/types";
import { env, hasMapbox } from "@/lib/env";

type Props = {
  hikes: Hike[];
  className?: string;
};

export function AllHikesMap({ hikes, className }: Props) {
  const router = useRouter();
  const mapRef = useRef<MapRef | null>(null);

  const featureCollection = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: hikes
        .filter((h) => h.points.length >= 2)
        .map((h) => ({
          type: "Feature" as const,
          properties: { id: h.id, name: h.name },
          geometry: {
            type: "LineString" as const,
            coordinates: h.points.map((p) => [p.lng, p.lat]),
          },
        })),
    }),
    [hikes]
  );

  const bounds = useMemo(() => {
    let minLng = Infinity,
      maxLng = -Infinity,
      minLat = Infinity,
      maxLat = -Infinity;
    for (const h of hikes) {
      for (const p of h.points) {
        if (p.lng < minLng) minLng = p.lng;
        if (p.lng > maxLng) maxLng = p.lng;
        if (p.lat < minLat) minLat = p.lat;
        if (p.lat > maxLat) maxLat = p.lat;
      }
    }
    if (!Number.isFinite(minLng)) return null;
    return { minLng, maxLng, minLat, maxLat };
  }, [hikes]);

  function handleLoad() {
    const map = mapRef.current?.getMap();
    if (!map || !bounds) return;
    map.fitBounds(
      [
        [bounds.minLng, bounds.minLat],
        [bounds.maxLng, bounds.maxLat],
      ],
      { padding: 50, duration: 0 }
    );
  }

  function handleClick(e: MapMouseEvent) {
    const feature = e.features?.[0];
    const id = feature?.properties?.id;
    if (typeof id === "string") router.push(`/hike/?id=${encodeURIComponent(id)}`);
  }

  if (!hasMapbox()) {
    return (
      <div
        className={`flex items-center justify-center bg-zinc-100 text-sm text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400 ${className ?? ""}`}
      >
        Set NEXT_PUBLIC_MAPBOX_TOKEN to see your map.
      </div>
    );
  }

  if (featureCollection.features.length === 0) {
    return null;
  }

  const initial = bounds
    ? { lng: (bounds.minLng + bounds.maxLng) / 2, lat: (bounds.minLat + bounds.maxLat) / 2 }
    : { lng: 9, lat: 47 };

  return (
    <div className={className}>
      <Map
        ref={mapRef}
        mapboxAccessToken={env.mapboxToken}
        initialViewState={{ longitude: initial.lng, latitude: initial.lat, zoom: 10 }}
        mapStyle="mapbox://styles/mapbox/outdoors-v12"
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
        onLoad={handleLoad}
        onClick={handleClick}
        interactiveLayerIds={["hikes-line"]}
        cursor="default"
      >
        <Source id="hikes" type="geojson" data={featureCollection}>
          <Layer
            id="hikes-shadow"
            type="line"
            paint={{ "line-color": "#000", "line-width": 6, "line-opacity": 0.2, "line-blur": 1 }}
            layout={{ "line-cap": "round", "line-join": "round" }}
          />
          <Layer
            id="hikes-line"
            type="line"
            paint={{ "line-color": "#f59e0b", "line-width": 3.5 }}
            layout={{ "line-cap": "round", "line-join": "round" }}
          />
        </Source>
      </Map>
    </div>
  );
}
