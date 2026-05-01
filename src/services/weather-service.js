const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const MAX_WEATHER_LOCATIONS = 12;
const HOURLY_VARIABLES = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'precipitation',
  'cloud_cover',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
];

export class WeatherService {
  /**
   * Loads route weather from Open-Meteo.
   *
   * @param {!Array<!Object>} track Route track.
   * @param {{date: string, hour: number}} selection Selected date and hour.
   * @return {!Promise<{samples: !Array<!Object>, source: string, message: string}>}
   */
  async loadRouteWeather(track, selection) {
    if (track.length < 2) {
      return {
        samples: createUnavailableWeatherSamples(track),
        source: 'none',
        message: '',
      };
    }

    try {
      const routeSamples = selectRouteWeatherSamples(track);
      const forecasts = await this.fetchForecast(routeSamples, selection.date);
      const weatherSamples = routeSamples.map((point, index) => {
        return parseForecastAtSelectedTime(point, forecasts[index], selection);
      });

      return {
        samples: interpolateWeatherSamples(track, weatherSamples),
        source: 'open-meteo',
        message: `Weather loaded for ${selection.date} at ${String(selection.hour).padStart(2, '0')}:00.`,
      };
    } catch (error) {
      return {
        samples: createUnavailableWeatherSamples(track),
        source: 'unavailable',
        message: 'Weather unavailable from the free API.',
      };
    }
  }

  /**
   * Fetches Open-Meteo forecast data for sampled route points.
   *
   * @param {!Array<!Object>} points Route sample points.
   * @param {string} date Forecast date.
   * @return {!Promise<!Array<!Object>>} Forecast payloads.
   */
  async fetchForecast(points, date) {
    const params = new URLSearchParams({
      latitude: points.map((point) => point.lat.toFixed(5)).join(','),
      longitude: points.map((point) => point.lng.toFixed(5)).join(','),
      hourly: HOURLY_VARIABLES.join(','),
      start_date: date,
      end_date: date,
      timezone: 'auto',
      temperature_unit: 'celsius',
      wind_speed_unit: 'kmh',
      precipitation_unit: 'mm',
    });
    const response = await fetch(`${OPEN_METEO_FORECAST_URL}?${params}`);

    if (!response.ok) {
      throw new Error(`Weather request failed: ${response.status}`);
    }

    const payload = await response.json();
    const forecasts = Array.isArray(payload) ? payload : [payload];

    if (forecasts.length !== points.length) {
      throw new Error('Weather response did not match requested route samples.');
    }

    return forecasts;
  }
}

/**
 * Creates unavailable weather samples.
 *
 * @param {!Array<!Object>} track Route track.
 * @return {!Array<!Object>} Weather samples.
 */
export function createUnavailableWeatherSamples(track) {
  return track.map((point) => ({
    ...point,
    apparentTemperatureCelsius: null,
    cloudCoverPercent: null,
    humidityPercent: null,
    precipitationMmHour: null,
    temperatureCelsius: null,
    windDirectionDegrees: null,
    windGustKmh: null,
    windSpeedKmh: null,
  }));
}

/**
 * Selects route points for forecast lookup.
 *
 * @param {!Array<!Object>} track Route track.
 * @return {!Array<!Object>} Route samples.
 */
function selectRouteWeatherSamples(track) {
  const sampleCount = Math.min(MAX_WEATHER_LOCATIONS, track.length);

  if (sampleCount === track.length) {
    return track;
  }

  const totalDistanceMeters = track[track.length - 1].cumulativeDistanceMeters || 1;
  const samples = [];

  for (let index = 0; index < sampleCount; index += 1) {
    const targetDistanceMeters = totalDistanceMeters * index / (sampleCount - 1);
    samples.push(findNearestTrackPoint(track, targetDistanceMeters));
  }

  return samples;
}

/**
 * Finds the nearest track point for a distance.
 *
 * @param {!Array<!Object>} track Route track.
 * @param {number} targetDistanceMeters Target distance.
 * @return {!Object} Track point.
 */
function findNearestTrackPoint(track, targetDistanceMeters) {
  let nearestPoint = track[0];
  let nearestDistanceMeters = Math.abs(track[0].cumulativeDistanceMeters - targetDistanceMeters);

  for (const point of track) {
    const distanceMeters = Math.abs(point.cumulativeDistanceMeters - targetDistanceMeters);

    if (distanceMeters < nearestDistanceMeters) {
      nearestPoint = point;
      nearestDistanceMeters = distanceMeters;
    }
  }

  return nearestPoint;
}

/**
 * Parses the forecast closest to the planner's selected time.
 *
 * @param {!Object} point Route point.
 * @param {!Object} forecast Open-Meteo forecast response.
 * @param {{date: string, hour: number}} selection Selected date and hour.
 * @return {!Object} Route weather sample.
 */
function parseForecastAtSelectedTime(point, forecast, selection) {
  const hourly = forecast.hourly;

  if (!hourly?.time?.length) {
    throw new Error('Weather response did not include hourly data.');
  }

  const index = findSelectedForecastIndex(hourly.time, selection);

  return {
    ...point,
    apparentTemperatureCelsius: readHourlyValue(hourly.apparent_temperature, index),
    cloudCoverPercent: readHourlyValue(hourly.cloud_cover, index),
    humidityPercent: readHourlyValue(hourly.relative_humidity_2m, index),
    precipitationMmHour: readHourlyValue(hourly.precipitation, index),
    temperatureCelsius: readHourlyValue(hourly.temperature_2m, index),
    windDirectionDegrees: readHourlyValue(hourly.wind_direction_10m, index),
    windGustKmh: readHourlyValue(hourly.wind_gusts_10m, index),
    windSpeedKmh: readHourlyValue(hourly.wind_speed_10m, index),
  };
}

/**
 * Finds the forecast index for the selected route-planning time.
 *
 * @param {!Array<string>} times Forecast times.
 * @param {{date: string, hour: number}} selection Selected date and hour.
 * @return {number} Forecast index.
 */
function findSelectedForecastIndex(times, selection) {
  const target = `${selection.date}T${String(selection.hour).padStart(2, '0')}:00`;
  const exactIndex = times.indexOf(target);

  if (exactIndex >= 0) {
    return exactIndex;
  }

  const targetTime = new Date(target).getTime();

  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  times.forEach((time, index) => {
    const forecastTime = new Date(time).getTime();
    const distance = Math.abs(forecastTime - targetTime);

    if (distance < nearestDistance) {
      nearestIndex = index;
      nearestDistance = distance;
    }
  });

  return nearestIndex;
}

/**
 * Reads a finite hourly value.
 *
 * @param {?Array<number>} values Hourly values.
 * @param {number} index Value index.
 * @return {number} Hourly value.
 */
function readHourlyValue(values, index) {
  const value = Number(values?.[index]);

  if (!Number.isFinite(value)) {
    throw new Error('Weather response included invalid hourly values.');
  }

  return value;
}

/**
 * Interpolates sampled route weather onto the full track.
 *
 * @param {!Array<!Object>} track Full route track.
 * @param {!Array<!Object>} weatherSamples Sampled weather.
 * @return {!Array<!Object>} Full route weather samples.
 */
function interpolateWeatherSamples(track, weatherSamples) {
  return track.map((point) => {
    const sampleIndex = findWeatherSampleIndex(weatherSamples, point.cumulativeDistanceMeters);
    const previousSample = weatherSamples[sampleIndex];
    const nextSample =
        weatherSamples[Math.min(sampleIndex + 1, weatherSamples.length - 1)];
    const sampleDistanceMeters =
        nextSample.cumulativeDistanceMeters - previousSample.cumulativeDistanceMeters;
    const ratio = sampleDistanceMeters > 0 ?
      (point.cumulativeDistanceMeters - previousSample.cumulativeDistanceMeters) /
          sampleDistanceMeters :
      0;

    return {
      ...point,
      apparentTemperatureCelsius:
          interpolateValue(previousSample, nextSample, 'apparentTemperatureCelsius', ratio),
      cloudCoverPercent: interpolateValue(previousSample, nextSample, 'cloudCoverPercent', ratio),
      humidityPercent: interpolateValue(previousSample, nextSample, 'humidityPercent', ratio),
      precipitationMmHour:
          interpolateValue(previousSample, nextSample, 'precipitationMmHour', ratio),
      temperatureCelsius:
          interpolateValue(previousSample, nextSample, 'temperatureCelsius', ratio),
      windDirectionDegrees:
          interpolateValue(previousSample, nextSample, 'windDirectionDegrees', ratio),
      windGustKmh: interpolateValue(previousSample, nextSample, 'windGustKmh', ratio),
      windSpeedKmh: interpolateValue(previousSample, nextSample, 'windSpeedKmh', ratio),
    };
  });
}

/**
 * Finds the preceding weather sample for a route distance.
 *
 * @param {!Array<!Object>} samples Weather samples.
 * @param {number} distanceMeters Route distance.
 * @return {number} Sample index.
 */
function findWeatherSampleIndex(samples, distanceMeters) {
  for (let index = 1; index < samples.length; index += 1) {
    if (samples[index].cumulativeDistanceMeters >= distanceMeters) {
      return index - 1;
    }
  }

  return Math.max(0, samples.length - 2);
}

/**
 * Interpolates a numeric weather value.
 *
 * @param {!Object} start Start sample.
 * @param {!Object} end End sample.
 * @param {string} key Value key.
 * @param {number} ratio Interpolation ratio.
 * @return {number} Interpolated value.
 */
function interpolateValue(start, end, key, ratio) {
  return start[key] + (end[key] - start[key]) * ratio;
}
