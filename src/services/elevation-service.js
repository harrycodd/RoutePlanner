import {
  addCumulativeDistance,
  clamp,
  interpolateCoordinate,
} from '../core/geo.js';

const OPEN_ELEVATION_URL = 'https://api.open-elevation.com/api/v1/lookup';
const MAX_ELEVATION_SAMPLES = 96;
const SMOOTHING_RADIUS = 2;

export class ElevationService {
  /**
   * Adds real elevation data to a route track.
   *
   * @param {!Array<{lat: number, lng: number}>} rawTrack Track points.
   * @return {!Promise<{track: !Array<!Object>, source: string, message: string}>}
   */
  async enrichTrack(rawTrack) {
    const track = addCumulativeDistance(rawTrack);

    if (track.length < 2) {
      return {
        track: track.map((point) => ({...point, elevationMeters: null})),
        source: 'none',
        message: '',
      };
    }

    try {
      const queryPoints = selectElevationSamples(track);
      const elevationSamples = await this.fetchOpenElevation(queryPoints);
      const enrichedTrack = interpolateElevation(track, elevationSamples);

      return {
        track: smoothElevationProfile(enrichedTrack),
        source: 'open-elevation',
        message: 'Elevation loaded from terrain data.',
      };
    } catch (error) {
      return {
        track: track.map((point) => ({...point, elevationMeters: null})),
        source: 'unavailable',
        message: 'Elevation unavailable. GPX will export without elevation values.',
      };
    }
  }

  /**
   * Fetches elevation values from Open-Elevation.
   *
   * @param {!Array<!Object>} points Query points.
   * @return {!Promise<!Array<!Object>>} Elevation samples.
   */
  async fetchOpenElevation(points) {
    const response = await fetch(OPEN_ELEVATION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        locations: points.map((point) => ({
          latitude: point.lat,
          longitude: point.lng,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(`Elevation request failed: ${response.status}`);
    }

    const payload = await response.json();
    const results = payload.results || [];

    if (results.length !== points.length) {
      throw new Error('Elevation response did not match requested points.');
    }

    return results.map((result, index) => {
      const elevationMeters = Number(result.elevation);

      if (!Number.isFinite(elevationMeters)) {
        throw new Error('Elevation response included invalid values.');
      }

      return {
        ...points[index],
        elevationMeters,
      };
    });
  }
}

/**
 * Selects evenly spaced elevation query points from a track.
 *
 * @param {!Array<!Object>} track Track with cumulative distance.
 * @return {!Array<!Object>} Query points.
 */
function selectElevationSamples(track) {
  if (track.length <= MAX_ELEVATION_SAMPLES) {
    return track;
  }

  const totalDistanceMeters = track[track.length - 1].cumulativeDistanceMeters;
  const samples = [];

  for (let index = 0; index < MAX_ELEVATION_SAMPLES; index += 1) {
    const targetDistanceMeters =
        totalDistanceMeters * index / (MAX_ELEVATION_SAMPLES - 1);
    samples.push(findPointAtDistance(track, targetDistanceMeters));
  }

  return samples;
}

/**
 * Finds an interpolated point at a distance along the track.
 *
 * @param {!Array<!Object>} track Track.
 * @param {number} targetDistanceMeters Target distance.
 * @return {!Object} Point.
 */
function findPointAtDistance(track, targetDistanceMeters) {
  for (let index = 1; index < track.length; index += 1) {
    const previousPoint = track[index - 1];
    const nextPoint = track[index];

    if (nextPoint.cumulativeDistanceMeters >= targetDistanceMeters) {
      const legDistanceMeters =
          nextPoint.cumulativeDistanceMeters - previousPoint.cumulativeDistanceMeters;
      const ratio = legDistanceMeters > 0 ?
        (targetDistanceMeters - previousPoint.cumulativeDistanceMeters) / legDistanceMeters :
        0;

      return {
        ...interpolateCoordinate(previousPoint, nextPoint, clamp(ratio, 0, 1)),
        cumulativeDistanceMeters: targetDistanceMeters,
      };
    }
  }

  return track[track.length - 1];
}

/**
 * Interpolates elevation samples onto every track point.
 *
 * @param {!Array<!Object>} track Track.
 * @param {!Array<!Object>} elevationSamples Elevation samples.
 * @return {!Array<!Object>} Enriched track.
 */
function interpolateElevation(track, elevationSamples) {
  return track.map((point) => {
    const sampleIndex = findSampleIndex(elevationSamples, point.cumulativeDistanceMeters);
    const previousSample = elevationSamples[sampleIndex];
    const nextSample = elevationSamples[Math.min(sampleIndex + 1, elevationSamples.length - 1)];
    const sampleDistanceMeters =
        nextSample.cumulativeDistanceMeters - previousSample.cumulativeDistanceMeters;
    const ratio = sampleDistanceMeters > 0 ?
      (point.cumulativeDistanceMeters - previousSample.cumulativeDistanceMeters) /
          sampleDistanceMeters :
      0;
    const elevationMeters = previousSample.elevationMeters +
        (nextSample.elevationMeters - previousSample.elevationMeters) *
            clamp(ratio, 0, 1);

    return {
      ...point,
      elevationMeters,
    };
  });
}

/**
 * Finds the preceding elevation sample for a distance.
 *
 * @param {!Array<!Object>} samples Samples.
 * @param {number} distanceMeters Distance.
 * @return {number} Sample index.
 */
function findSampleIndex(samples, distanceMeters) {
  for (let index = 1; index < samples.length; index += 1) {
    if (samples[index].cumulativeDistanceMeters >= distanceMeters) {
      return index - 1;
    }
  }

  return Math.max(0, samples.length - 2);
}

/**
 * Smooths sampled DEM elevation for display and gain calculations.
 *
 * @param {!Array<!Object>} track Track with elevation.
 * @return {!Array<!Object>} Smoothed track.
 */
function smoothElevationProfile(track) {
  return track.map((point, index) => {
    let totalWeight = 0;
    let weightedElevation = 0;

    for (
      let sampleIndex = index - SMOOTHING_RADIUS;
      sampleIndex <= index + SMOOTHING_RADIUS;
      sampleIndex += 1
    ) {
      if (!track[sampleIndex]) {
        continue;
      }

      const distanceFromCenter = Math.abs(sampleIndex - index);
      const weight = SMOOTHING_RADIUS + 1 - distanceFromCenter;
      totalWeight += weight;
      weightedElevation += track[sampleIndex].elevationMeters * weight;
    }

    return {
      ...point,
      elevationMeters: Math.round(weightedElevation / totalWeight),
    };
  });
}
