const EARTH_RADIUS_METERS = 6371008.8;
const METERS_PER_KILOMETER = 1000;

/**
 * Converts degrees to radians.
 *
 * @param {number} degrees Angle in degrees.
 * @return {number} Angle in radians.
 */
export function toRadians(degrees) {
  return degrees * Math.PI / 180;
}

/**
 * Converts radians to degrees.
 *
 * @param {number} radians Angle in radians.
 * @return {number} Angle in degrees.
 */
export function toDegrees(radians) {
  return radians * 180 / Math.PI;
}

/**
 * Calculates the distance between two coordinates.
 *
 * @param {{lat: number, lng: number}} start Start coordinate.
 * @param {{lat: number, lng: number}} end End coordinate.
 * @return {number} Distance in meters.
 */
export function haversineDistanceMeters(start, end) {
  const deltaLat = toRadians(end.lat - start.lat);
  const deltaLng = toRadians(end.lng - start.lng);
  const startLat = toRadians(start.lat);
  const endLat = toRadians(end.lat);
  const a = Math.sin(deltaLat / 2) ** 2 +
      Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLng / 2) ** 2;
  const centralAngle = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * centralAngle;
}

/**
 * Returns the bearing from one coordinate to another.
 *
 * @param {{lat: number, lng: number}} start Start coordinate.
 * @param {{lat: number, lng: number}} end End coordinate.
 * @return {number} Bearing in degrees.
 */
export function bearingDegrees(start, end) {
  const startLat = toRadians(start.lat);
  const endLat = toRadians(end.lat);
  const deltaLng = toRadians(end.lng - start.lng);
  const y = Math.sin(deltaLng) * Math.cos(endLat);
  const x = Math.cos(startLat) * Math.sin(endLat) -
      Math.sin(startLat) * Math.cos(endLat) * Math.cos(deltaLng);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Calculates the total distance of a polyline.
 *
 * @param {!Array<{lat: number, lng: number}>} points Route points.
 * @return {number} Distance in meters.
 */
export function polylineDistanceMeters(points) {
  let distanceMeters = 0;

  for (let index = 1; index < points.length; index += 1) {
    distanceMeters += haversineDistanceMeters(points[index - 1], points[index]);
  }

  return distanceMeters;
}

/**
 * Adds cumulative distance to each point.
 *
 * @param {!Array<{lat: number, lng: number}>} points Route points.
 * @return {!Array<{lat: number, lng: number, cumulativeDistanceMeters: number}>}
 */
export function addCumulativeDistance(points) {
  let cumulativeDistanceMeters = 0;

  return points.map((point, index) => {
    if (index > 0) {
      cumulativeDistanceMeters += haversineDistanceMeters(points[index - 1], point);
    }

    return {
      ...point,
      cumulativeDistanceMeters,
    };
  });
}

/**
 * Interpolates a coordinate between two coordinates.
 *
 * @param {{lat: number, lng: number}} start Start coordinate.
 * @param {{lat: number, lng: number}} end End coordinate.
 * @param {number} ratio Interpolation ratio.
 * @return {{lat: number, lng: number}} Coordinate.
 */
export function interpolateCoordinate(start, end, ratio) {
  return {
    lat: start.lat + (end.lat - start.lat) * ratio,
    lng: start.lng + (end.lng - start.lng) * ratio,
  };
}

/**
 * Creates a dense fallback track from sparse waypoints.
 *
 * @param {!Array<{lat: number, lng: number}>} waypoints Route waypoints.
 * @param {number=} targetSpacingMeters Preferred spacing between track points.
 * @return {!Array<{lat: number, lng: number}>}
 */
export function interpolateTrack(waypoints, targetSpacingMeters = 350) {
  if (waypoints.length < 2) {
    return [...waypoints];
  }

  const track = [];

  for (let index = 1; index < waypoints.length; index += 1) {
    const start = waypoints[index - 1];
    const end = waypoints[index];
    const legDistanceMeters = haversineDistanceMeters(start, end);
    const samples = Math.max(2, Math.ceil(legDistanceMeters / targetSpacingMeters));

    if (index === 1) {
      track.push(start);
    }

    for (let sampleIndex = 1; sampleIndex <= samples; sampleIndex += 1) {
      track.push(interpolateCoordinate(start, end, sampleIndex / samples));
    }
  }

  return track;
}

/**
 * Formats a distance in kilometers.
 *
 * @param {number} meters Distance in meters.
 * @return {string} Formatted value.
 */
export function formatDistanceKilometers(meters) {
  return `${(meters / METERS_PER_KILOMETER).toFixed(1)} km`;
}

/**
 * Formats a duration in seconds as h:mm:ss.
 *
 * @param {number} seconds Duration in seconds.
 * @return {string} Formatted value.
 */
export function formatDuration(seconds) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

/**
 * Clamps a number.
 *
 * @param {number} value Value to clamp.
 * @param {number} min Minimum value.
 * @param {number} max Maximum value.
 * @return {number} Clamped value.
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
