import {
  haversineDistanceMeters,
} from '../core/geo.js';

const ELEVATION_GAIN_THRESHOLD_METERS = 1;
const ELEVATION_METRIC_SPACING_METERS = 75;

const ACTIVITY_MODELS = {
  ride: {
    baseSpeedKmh: 29,
    climbingHoursPerMeter: 0.00095,
    defaultSurface: [
      {name: 'Paved', ratio: 0.84, color: '#5b91e7'},
      {name: 'Gravel', ratio: 0.11, color: '#a9b7c7'},
      {name: 'Dirt', ratio: 0.04, color: '#ff971f'},
      {name: 'Other', ratio: 0.01, color: '#7c8794'},
    ],
  },
  run: {
    baseSpeedKmh: 10.8,
    climbingHoursPerMeter: 0.0013,
    defaultSurface: [
      {name: 'Paved', ratio: 0.58, color: '#5b91e7'},
      {name: 'Gravel', ratio: 0.22, color: '#a9b7c7'},
      {name: 'Dirt', ratio: 0.17, color: '#ff971f'},
      {name: 'Other', ratio: 0.03, color: '#7c8794'},
    ],
  },
  hike: {
    baseSpeedKmh: 4.9,
    climbingHoursPerMeter: 0.0017,
    defaultSurface: [
      {name: 'Paved', ratio: 0.28, color: '#5b91e7'},
      {name: 'Gravel', ratio: 0.24, color: '#a9b7c7'},
      {name: 'Dirt', ratio: 0.42, color: '#ff971f'},
      {name: 'Other', ratio: 0.06, color: '#7c8794'},
    ],
  },
};

/**
 * Calculates core route metrics.
 *
 * @param {!Array<{lat: number, lng: number, cumulativeDistanceMeters: number,
 *     elevationMeters: number}>} track Analyzed track.
 * @param {string} activity Activity id.
 * @return {!Object} Route metrics.
 */
export function calculateRouteMetrics(track, activity) {
  if (track.length === 0) {
    return createEmptyMetrics(activity);
  }

  let elevationGainMeters = 0;
  let elevationLossMeters = 0;
  const elevationValues = track
      .map((point) => point.elevationMeters)
      .filter((elevationMeters) => Number.isFinite(elevationMeters));
  const hasElevation = elevationValues.length === track.length;

  if (hasElevation) {
    const elevationProfile = createDistanceSpacedElevationProfile(track);

    for (let index = 1; index < elevationProfile.length; index += 1) {
      const delta =
          elevationProfile[index].elevationMeters -
          elevationProfile[index - 1].elevationMeters;

      if (delta > ELEVATION_GAIN_THRESHOLD_METERS) {
        elevationGainMeters += delta;
      } else if (delta < -ELEVATION_GAIN_THRESHOLD_METERS) {
        elevationLossMeters += Math.abs(delta);
      }
    }
  }

  const distanceMeters = track[track.length - 1].cumulativeDistanceMeters;
  const model = ACTIVITY_MODELS[activity] || ACTIVITY_MODELS.ride;
  const distanceHours = (distanceMeters / 1000) / model.baseSpeedKmh;
  const climbingHours = elevationGainMeters * model.climbingHoursPerMeter;
  const estimatedSeconds = Math.round((distanceHours + climbingHours) * 3600);
  const routeType = getRouteType(track, distanceMeters);
  const surfaces = model.defaultSurface.map((surface) => ({
    ...surface,
    distanceMeters: Math.round(distanceMeters * surface.ratio),
  }));

  return {
    activity,
    distanceMeters,
    elevationGainMeters: Math.round(elevationGainMeters),
    elevationLossMeters: Math.round(elevationLossMeters),
    estimatedSeconds,
    hasElevation,
    maxElevationMeters: hasElevation ? Math.max(...elevationValues) : null,
    minElevationMeters: hasElevation ? Math.min(...elevationValues) : null,
    routeType,
    surfaces,
  };
}

/**
 * Reduces a track to distance-spaced elevation points for stable gain/loss.
 *
 * @param {!Array<!Object>} track Track.
 * @return {!Array<!Object>} Distance-spaced elevation profile.
 */
function createDistanceSpacedElevationProfile(track) {
  const profile = [track[0]];
  let nextDistanceMeters = ELEVATION_METRIC_SPACING_METERS;

  for (const point of track) {
    if (point.cumulativeDistanceMeters >= nextDistanceMeters) {
      profile.push(point);
      nextDistanceMeters += ELEVATION_METRIC_SPACING_METERS;
    }
  }

  const finalPoint = track[track.length - 1];

  if (profile[profile.length - 1] !== finalPoint) {
    profile.push(finalPoint);
  }

  return profile;
}

/**
 * Creates blank route metrics.
 *
 * @param {string} activity Activity id.
 * @return {!Object} Empty metrics.
 */
function createEmptyMetrics(activity) {
  return {
    activity,
    distanceMeters: 0,
    elevationGainMeters: 0,
    elevationLossMeters: 0,
    estimatedSeconds: 0,
    hasElevation: false,
    maxElevationMeters: 0,
    minElevationMeters: 0,
    routeType: 'Open',
    surfaces: [],
  };
}

/**
 * Determines whether a route looks like a loop.
 *
 * @param {!Array<{lat: number, lng: number}>} track Track.
 * @param {number} distanceMeters Route distance.
 * @return {string} Route type label.
 */
function getRouteType(track, distanceMeters) {
  if (track.length < 2 || distanceMeters === 0) {
    return 'Open';
  }

  const closingDistanceMeters = haversineDistanceMeters(track[0], track[track.length - 1]);
  const loopThresholdMeters = Math.min(900, distanceMeters * 0.05);

  return closingDistanceMeters <= loopThresholdMeters ? 'Loop' : 'Point to Point';
}
