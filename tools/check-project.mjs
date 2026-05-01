import assert from 'node:assert/strict';

import {
  addHoursToSelection,
  clampForecastDate,
  normalizeHour,
} from '../src/core/date-time.js';
import {addCumulativeDistance} from '../src/core/geo.js';
import {interpolateTrack} from '../src/core/geo.js';
import {SAMPLE_WAYPOINTS} from '../src/domain/sample-route.js';
import {calculateRouteMetrics} from '../src/domain/route-metrics.js';
import {
  summarizeWeather,
} from '../src/domain/weather-model.js';
import {createGpxDocument} from '../src/services/gpx-exporter.js';

const fallbackTrack = interpolateTrack(SAMPLE_WAYPOINTS);
const analyzedTrack = addCumulativeDistance(fallbackTrack).map((point, index) => ({
  ...point,
  elevationMeters: 110 + Math.round(80 * Math.sin(index / 8) + index * 0.6),
}));
const metrics = calculateRouteMetrics(analyzedTrack, 'ride');
const weatherSamples = analyzedTrack.map((point, index) => ({
  ...point,
  apparentTemperatureCelsius: 13 + Math.sin(index / 3),
  cloudCoverPercent: 42 + index % 18,
  humidityPercent: 70 - index % 10,
  precipitationMmHour: 0.2,
  temperatureCelsius: 14 + Math.sin(index / 4),
  windDirectionDegrees: 245,
  windGustKmh: 32,
  windSpeedKmh: 22,
}));
const weatherSummary = summarizeWeather(weatherSamples);
const gpx = createGpxDocument({
  name: 'Check Route',
  activity: 'ride',
  track: analyzedTrack,
  metrics,
  createdAt: new Date('2026-05-01T09:00:00.000Z'),
});

assert.ok(fallbackTrack.length > SAMPLE_WAYPOINTS.length);
assert.ok(metrics.distanceMeters > 1000);
assert.ok(metrics.elevationGainMeters > 0);
assert.equal(metrics.routeType, 'Loop');
assert.ok(weatherSamples.length === analyzedTrack.length);
assert.ok(weatherSummary.averageWindKmh > 0);
assert.equal(normalizeHour(28), 23);
assert.match(clampForecastDate('not-a-date'), /^\d{4}-\d{2}-\d{2}$/);
assert.equal(addHoursToSelection('2000-01-01', 0, -1).hour, 0);
assert.match(gpx, /<gpx version="1.1"/);
assert.match(gpx, /<trkpt lat="/);
assert.match(gpx, /<ele>/);

console.log('Project checks passed.');
