
import type { DeviceCoords } from '@/features/events/deviceLocation';

// Mean radius. The error against the real ellipsoid is far smaller than the
// error already built into measuring a trip as a straight line.
const EARTH_RADIUS_MILES = 3958.8;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

// Great circle distance. This is the straight line between two points, not the
// distance anyone actually travels: around Alamitos Bay a place half a mile
// across the water is a three mile drive. The card says "~" for that reason.
// A real travel distance would need the Routes API, which is a separate API
// and a separate bill.
export function distanceInMiles(
  from: DeviceCoords,
  to: DeviceCoords
): number {
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLng = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.sin(deltaLng / 2) ** 2 *
      Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude));

  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(a));
}

// Whole miles, because a straight line measurement does not deserve a decimal
// point. Under a mile gets its own wording: rounding would print "~0 mi" for a
// place across the street.
export function formatDistance(miles: number): string {
  if (!Number.isFinite(miles) || miles < 0) return '';
  if (miles < 1) return '< 1 mi';

  return `~${Math.round(miles)} mi`;
}
