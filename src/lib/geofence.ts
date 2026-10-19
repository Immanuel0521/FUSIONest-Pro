/**
 * Geofencing Utilities for Construction Site Attendance
 *
 * Uses the Haversine formula to calculate distance between GPS coordinates.
 * Supports configurable site boundaries and accuracy-based validation.
 */

export interface SiteBoundary {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  name: string;
}

export type GeofenceVerdict = 'on_site' | 'outside_site' | 'unverifiable';

export interface GeofenceResult {
  verdict: GeofenceVerdict;
  distanceMeters: number;
  siteName: string;
  accuracy: number;
  message: string;
}

/** Default site radius in meters */
export const DEFAULT_SITE_RADIUS_METERS = 150;

/** GPS accuracy threshold – positions with accuracy worse than this are flagged */
export const GPS_ACCURACY_THRESHOLD_METERS = 50;

/**
 * Haversine formula: compute the great-circle distance (in metres) between
 * two points on the Earth's surface given their latitude and longitude in
 * decimal degrees.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000; // Earth radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Verify whether a worker's GPS position falls within a construction site
 * boundary.  Returns a structured verdict with distance, accuracy flag, and
 * human-readable message.
 */
export function verifyGeofence(
  workerLat: number,
  workerLng: number,
  gpsAccuracy: number,
  site: SiteBoundary,
): GeofenceResult {
  // If GPS accuracy is worse than threshold, mark unverifiable
  if (gpsAccuracy > GPS_ACCURACY_THRESHOLD_METERS) {
    return {
      verdict: 'unverifiable',
      distanceMeters: -1,
      siteName: site.name,
      accuracy: gpsAccuracy,
      message: `GPS accuracy too low (${Math.round(gpsAccuracy)}m). Move to an open area or try again.`,
    };
  }

  const distance = haversineDistance(workerLat, workerLng, site.latitude, site.longitude);
  const roundedDistance = Math.round(distance);

  if (distance <= site.radiusMeters) {
    return {
      verdict: 'on_site',
      distanceMeters: roundedDistance,
      siteName: site.name,
      accuracy: gpsAccuracy,
      message: `On site – ${roundedDistance}m from ${site.name} centre`,
    };
  }

  return {
    verdict: 'outside_site',
    distanceMeters: roundedDistance,
    siteName: site.name,
    accuracy: gpsAccuracy,
    message: `Outside site boundary – ${roundedDistance}m from ${site.name} (max ${site.radiusMeters}m)`,
  };
}

/**
 * Round GPS coordinates to 5 decimal places (~1.1 m precision).
 * Reduces unnecessary granularity while still proving presence on-site.
 */
export function roundCoordinates(lat: number, lng: number): { lat: number; lng: number } {
  return {
    lat: Number(lat.toFixed(5)),
    lng: Number(lng.toFixed(5)),
  };
}

/**
 * Basic mock-location detection heuristic.
 * On many mock-GPS apps, `coords.accuracy` reports an unnaturally precise
 * value (exactly 0) or a missing speed/altitude.  This doesn't catch all
 * spoofing, but it raises a flag for review.
 */
export function detectPossibleMockLocation(accuracy: number, speed: number | null): boolean {
  if (accuracy === 0) return true;
  // Extremely precise accuracy (< 1m) with no speed is suspicious
  if (accuracy < 1 && (speed === null || speed === 0)) return true;
  return false;
}
