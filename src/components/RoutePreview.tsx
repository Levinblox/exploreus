type LatLng = { lat: number; lng: number };

type Props = {
  points: LatLng[];
  className?: string;
  stroke?: string;
  strokeWidth?: number;
};

export function RoutePreview({
  points,
  className,
  stroke = "#f59e0b",
  strokeWidth = 2.6,
}: Props) {
  if (points.length < 2) {
    return (
      <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
        <circle cx="50" cy="50" r="3" fill={stroke} />
      </svg>
    );
  }

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const p of points) {
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
  }
  const lngRange = maxLng - minLng || 1e-5;
  const latRange = maxLat - minLat || 1e-5;

  const midLat = (minLat + maxLat) / 2;
  const xScale = Math.cos((midLat * Math.PI) / 180);
  const w = lngRange * xScale;
  const h = latRange;
  const maxDim = Math.max(w, h);
  const padding = 12;
  const usable = 100 - padding * 2;
  const scale = usable / maxDim;

  const projW = w * scale;
  const projH = h * scale;
  const offsetX = (100 - projW) / 2;
  const offsetY = (100 - projH) / 2;

  const path = points
    .map((p, i) => {
      const x = offsetX + (p.lng - minLng) * xScale * scale;
      const y = 100 - (offsetY + (p.lat - minLat) * scale);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
