"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Layer, Map, type MapRef, Marker, Source } from "react-map-gl/mapbox";
import type { GeoPoint } from "@/lib/types";
import { env, hasMapbox } from "@/lib/env";
import { getUserSettings, type MapStyle, updateMapStyle } from "@/lib/userSettings";

const STYLE_URL: Record<MapStyle, string> = {
  outdoors: "mapbox://styles/mapbox/outdoors-v12",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
  streets: "mapbox://styles/mapbox/streets-v12",
};

type UserLocation = {
  lat: number;
  lng: number;
  heading?: number | null;
  accuracy?: number | null;
};

type HighlightPoint = { lat: number; lng: number };

type Props = {
  points: GeoPoint[];
  userLocation?: UserLocation | null;
  compassHeading?: number | null;
  highlightPoint?: HighlightPoint | null;
  follow?: boolean;
  is3D?: boolean;
  fitOnLoad?: boolean;
  showDirection?: boolean;
  arrowVariant?: ArrowVariant;
  arrowSpacing?: number;
  mapStyle?: MapStyle;
  showStyleControl?: boolean;
  className?: string;
};

const STYLE_CYCLE: MapStyle[] = ["outdoors", "satellite", "streets"];
const STYLE_LABEL: Record<MapStyle, string> = {
  outdoors: "Outdoors",
  satellite: "Satellite",
  streets: "Streets",
};

export function MapView({
  points,
  userLocation,
  compassHeading,
  highlightPoint,
  follow = true,
  is3D = false,
  fitOnLoad = false,
  showDirection = false,
  arrowVariant = "double-chevron",
  arrowSpacing = 70,
  mapStyle,
  showStyleControl = true,
  className,
}: Props) {
  const [internalStyle, setInternalStyle] = useState<MapStyle>(() => {
    if (typeof window === "undefined") return "outdoors";
    return getUserSettings().mapStyle;
  });
  const effectiveStyle: MapStyle = mapStyle ?? internalStyle;

  function cycleStyle() {
    const idx = STYLE_CYCLE.indexOf(effectiveStyle);
    const next = STYLE_CYCLE[(idx + 1) % STYLE_CYCLE.length];
    setInternalStyle(next);
    updateMapStyle(next);
  }

  const mapRef = useRef<MapRef | null>(null);
  const centeredOnce = useRef(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const is3DRef = useRef(is3D);
  is3DRef.current = is3D;
  const arrowVariantRef = useRef(arrowVariant);
  arrowVariantRef.current = arrowVariant;

  const lineGeoJson = useMemo(
    () => ({
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: points.map((p) => [p.lng, p.lat]),
      },
    }),
    [points]
  );

  useEffect(() => {
    if (!userLocation || !mapRef.current) return;
    const map = mapRef.current;
    if (!centeredOnce.current) {
      map.jumpTo({ center: [userLocation.lng, userLocation.lat], zoom: 16 });
      centeredOnce.current = true;
      return;
    }
    if (follow) {
      map.easeTo({
        center: [userLocation.lng, userLocation.lat],
        duration: 700,
      });
    }
  }, [userLocation, follow]);

  useEffect(() => {
    if (!highlightPoint || !mapRef.current || !mapLoaded) return;
    mapRef.current.easeTo({
      center: [highlightPoint.lng, highlightPoint.lat],
      duration: 400,
    });
  }, [highlightPoint, mapLoaded]);

  // Style swaps drop sources/images — re-add them whenever a new style loads.
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current.getMap();
    const reapply = () => {
      if (!map.getSource("mapbox-dem")) {
        map.addSource("mapbox-dem", {
          type: "raster-dem",
          url: "mapbox://mapbox.mapbox-terrain-dem-v1",
          tileSize: 512,
          maxzoom: 14,
        });
      }
      const arrowImageId = `trail-arrow-${arrowVariantRef.current}`;
      if (!map.hasImage(arrowImageId)) {
        const img = makeArrowImage(arrowVariantRef.current);
        if (img) map.addImage(arrowImageId, img, { pixelRatio: 2 });
      }
      if (is3DRef.current) {
        try {
          map.setTerrain({ source: "mapbox-dem", exaggeration: 1.4 });
        } catch {
          // terrain source not yet ready
        }
      }
    };
    map.on("style.load", reapply);
    return () => {
      map.off("style.load", reapply);
    };
  }, [mapLoaded]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current.getMap();
    if (is3D) {
      try {
        map.setTerrain({ source: "mapbox-dem", exaggeration: 1.4 });
      } catch {
        // terrain source not yet ready — onLoad adds it; effect re-runs on mapLoaded.
      }
      map.easeTo({ pitch: 60, duration: 700 });
    } else {
      try {
        map.setTerrain(null);
      } catch {
        // ignore
      }
      map.easeTo({ pitch: 0, duration: 700 });
    }
  }, [is3D, mapLoaded]);

  function handleLoad() {
    const map = mapRef.current?.getMap();
    if (!map) return;

    if (!map.getSource("mapbox-dem")) {
      map.addSource("mapbox-dem", {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
        maxzoom: 14,
      });
    }

    const arrowImageId = `trail-arrow-${arrowVariant}`;
    if (!map.hasImage(arrowImageId)) {
      const img = makeArrowImage(arrowVariant);
      if (img) map.addImage(arrowImageId, img, { pixelRatio: 2 });
    }

    if (fitOnLoad && points.length > 1) {
      let minLng = 180,
        maxLng = -180,
        minLat = 90,
        maxLat = -90;
      for (const p of points) {
        if (p.lng < minLng) minLng = p.lng;
        if (p.lng > maxLng) maxLng = p.lng;
        if (p.lat < minLat) minLat = p.lat;
        if (p.lat > maxLat) maxLat = p.lat;
      }
      map.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        { padding: 60, duration: 0 }
      );
    }

    setMapLoaded(true);
  }

  if (!hasMapbox()) {
    return (
      <div
        className={`flex items-center justify-center bg-zinc-100 text-center text-sm text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400 ${className ?? ""}`}
      >
        <div className="max-w-xs p-6">
          Set <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">NEXT_PUBLIC_MAPBOX_TOKEN</code> in <code>.env.local</code> to enable the map.
        </div>
      </div>
    );
  }

  const fallback = { lng: 9.0, lat: 47.0 };
  const initial = userLocation ?? (points[0] ? { lng: points[0].lng, lat: points[0].lat } : fallback);

  return (
    <div className={className}>
      <Map
        ref={mapRef}
        mapboxAccessToken={env.mapboxToken}
        initialViewState={{ longitude: initial.lng, latitude: initial.lat, zoom: 16 }}
        mapStyle={STYLE_URL[effectiveStyle]}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
        onLoad={handleLoad}
      >
        {points.length > 1 && (
          <Source id="track" type="geojson" data={lineGeoJson}>
            <Layer
              id="track-shadow"
              type="line"
              paint={{ "line-color": "#000", "line-width": 7, "line-opacity": 0.18, "line-blur": 1 }}
              layout={{ "line-cap": "round", "line-join": "round" }}
            />
            <Layer
              id="track-line"
              type="line"
              paint={{ "line-color": "#f59e0b", "line-width": 5 }}
              layout={{ "line-cap": "round", "line-join": "round" }}
            />
            {showDirection && (
              <Layer
                id="track-arrows"
                type="symbol"
                layout={{
                  "symbol-placement": "line",
                  "symbol-spacing": arrowSpacing,
                  "icon-image": `trail-arrow-${arrowVariant}`,
                  "icon-size": 1,
                  "icon-allow-overlap": true,
                  "icon-ignore-placement": true,
                  "icon-rotation-alignment": "map",
                  "icon-pitch-alignment": "map",
                  "icon-keep-upright": false,
                }}
              />
            )}
          </Source>
        )}

        {highlightPoint && (
          <Marker longitude={highlightPoint.lng} latitude={highlightPoint.lat} anchor="center">
            <div className="h-4 w-4 rounded-full border-[3px] border-white bg-sky-500 shadow-lg shadow-sky-500/40" />
          </Marker>
        )}

        {userLocation && (
          <Marker longitude={userLocation.lng} latitude={userLocation.lat} anchor="center">
            <UserDot heading={compassHeading ?? userLocation.heading ?? null} />
          </Marker>
        )}
      </Map>

      {showStyleControl && (
        <button
          type="button"
          onClick={cycleStyle}
          className="absolute bottom-5 left-4 z-10 flex h-12 items-center gap-1.5 rounded-full bg-white pl-3 pr-4 font-display text-xs font-bold uppercase tracking-wider text-zinc-900 shadow-xl ring-1 ring-black/5 active:scale-95 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-white/10"
          aria-label={`Map style: ${STYLE_LABEL[effectiveStyle]}. Tap to change.`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l9 4.5-9 4.5-9-4.5z" />
            <path d="M3 12l9 4.5 9-4.5" />
            <path d="M3 16.5l9 4.5 9-4.5" />
          </svg>
          {STYLE_LABEL[effectiveStyle]}
        </button>
      )}
    </div>
  );
}

export type ArrowVariant =
  | "chevron"
  | "double-chevron"
  | "triangle"
  | "full-arrow"
  | "minimal"
  | "amber"
  | "curved-chevron"
  | "teardrop"
  | "comet"
  | "wing"
  | "brushstroke"
  | "dot-trail";

function newCanvas(size: number) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  return ctx ? { canvas, ctx } : null;
}

function makeArrowImage(variant: ArrowVariant = "chevron"): ImageData | null {
  const setup = newCanvas(variant === "minimal" ? 20 : 28);
  if (!setup) return null;
  const { canvas, ctx } = setup;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (variant === "chevron") {
    const draw = () => {
      ctx.beginPath();
      ctx.moveTo(9, 6);
      ctx.lineTo(19, 14);
      ctx.lineTo(9, 22);
    };
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 7;
    draw();
    ctx.stroke();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 4;
    draw();
    ctx.stroke();
  } else if (variant === "double-chevron") {
    const draw = (offsetX: number) => {
      ctx.beginPath();
      ctx.moveTo(5 + offsetX, 7);
      ctx.lineTo(13 + offsetX, 14);
      ctx.lineTo(5 + offsetX, 21);
    };
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 6;
    draw(0);
    ctx.stroke();
    draw(7);
    ctx.stroke();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    draw(0);
    ctx.stroke();
    draw(7);
    ctx.stroke();
  } else if (variant === "triangle") {
    const draw = () => {
      ctx.beginPath();
      ctx.moveTo(7, 5);
      ctx.lineTo(22, 14);
      ctx.lineTo(7, 23);
      ctx.closePath();
    };
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    draw();
    ctx.translate(0, 0);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    draw();
    ctx.fill();
  } else if (variant === "full-arrow") {
    // Shaft + arrowhead
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(4, 14);
    ctx.lineTo(22, 14);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(14, 6);
    ctx.lineTo(22, 14);
    ctx.lineTo(14, 22);
    ctx.stroke();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(4, 14);
    ctx.lineTo(22, 14);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(14, 6);
    ctx.lineTo(22, 14);
    ctx.lineTo(14, 22);
    ctx.stroke();
  } else if (variant === "minimal") {
    // Small filled triangle, low-key
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(6, 5);
    ctx.lineTo(15, 10);
    ctx.lineTo(6, 15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (variant === "amber") {
    const draw = () => {
      ctx.beginPath();
      ctx.moveTo(9, 6);
      ctx.lineTo(19, 14);
      ctx.lineTo(9, 22);
    };
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 7;
    draw();
    ctx.stroke();
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 4;
    draw();
    ctx.stroke();
  } else if (variant === "curved-chevron") {
    // Smooth swept chevron — sharp angles softened with bezier curves.
    const draw = () => {
      ctx.beginPath();
      ctx.moveTo(8, 6);
      ctx.bezierCurveTo(16, 9, 20, 11, 21, 14);
      ctx.bezierCurveTo(20, 17, 16, 19, 8, 22);
    };
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 7;
    draw();
    ctx.stroke();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 4;
    draw();
    ctx.stroke();
  } else if (variant === "teardrop") {
    // Rounded body, pointed tip — like a water drop heading forward.
    const draw = () => {
      ctx.beginPath();
      ctx.moveTo(23, 14);
      ctx.bezierCurveTo(21, 6, 12, 5, 7, 9);
      ctx.bezierCurveTo(3, 12, 3, 16, 7, 19);
      ctx.bezierCurveTo(12, 23, 21, 22, 23, 14);
      ctx.closePath();
    };
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    draw();
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    draw();
    ctx.fill();
  } else if (variant === "comet") {
    // Solid head + fading translucent tail behind it.
    const tail = ctx.createLinearGradient(2, 14, 16, 14);
    tail.addColorStop(0, "rgba(255,255,255,0)");
    tail.addColorStop(1, "rgba(255,255,255,0.75)");
    ctx.fillStyle = tail;
    ctx.beginPath();
    ctx.moveTo(2, 13);
    ctx.bezierCurveTo(8, 12, 14, 12, 16, 13);
    ctx.lineTo(16, 15);
    ctx.bezierCurveTo(14, 16, 8, 16, 2, 15);
    ctx.closePath();
    ctx.fill();
    // Head — filled rounded arrowhead
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(23, 14);
    ctx.bezierCurveTo(20, 7, 16, 7, 14, 10);
    ctx.lineTo(14, 18);
    ctx.bezierCurveTo(16, 21, 20, 21, 23, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (variant === "wing") {
    // Paper-airplane / aerodynamic wing — sharp tip, swept back edges, notch.
    const draw = () => {
      ctx.beginPath();
      ctx.moveTo(23, 14);
      ctx.lineTo(7, 5);
      ctx.lineTo(14, 14);
      ctx.lineTo(7, 23);
      ctx.closePath();
    };
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    draw();
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    draw();
    ctx.fill();
  } else if (variant === "brushstroke") {
    // Single calligraphic stroke that thickens toward the tip.
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(4, 12);
    ctx.bezierCurveTo(10, 11, 16, 11, 23, 13);
    ctx.bezierCurveTo(20, 14, 20, 14, 23, 15);
    ctx.bezierCurveTo(16, 17, 10, 17, 4, 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (variant === "dot-trail") {
    // Three dots increasing in size toward direction — implies forward motion.
    const dots: Array<[number, number, number]> = [
      [6, 14, 1.8],
      [13, 14, 2.6],
      [21, 14, 3.6],
    ];
    for (const [x, y, r] of dots) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.arc(x, y, r + 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function UserDot({ heading }: { heading: number | null }) {
  return (
    <div className="relative h-6 w-6">
      {heading != null && (
        <svg
          viewBox="-40 -40 80 80"
          className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-20"
          style={{ transform: `translate(-50%, -50%) rotate(${heading}deg)` }}
        >
          <defs>
            <radialGradient
              id="user-cone-grad"
              cx="0"
              cy="0"
              r="40"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
            </radialGradient>
          </defs>
          <path d="M 0 0 L -22 -35 Q 0 -42 22 -35 Z" fill="url(#user-cone-grad)" />
        </svg>
      )}
      <span className="absolute inset-0 rounded-full bg-sky-500/40 animate-ping" />
      <span className="absolute inset-0 rounded-full bg-sky-500 border-[3px] border-white shadow-lg shadow-sky-500/40" />
    </div>
  );
}
