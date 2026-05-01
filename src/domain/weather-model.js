/**
 * Summarizes weather samples.
 *
 * @param {!Array<!Object>} samples Weather samples.
 * @return {!Object} Weather summary.
 */
export function summarizeWeather(samples) {
  const validSamples = samples.filter((sample) => {
    return Number.isFinite(sample.temperatureCelsius) &&
        Number.isFinite(sample.windSpeedKmh);
  });

  if (validSamples.length === 0) {
    return {
      hasWeather: false,
      averageApparentTemperatureCelsius: null,
      averageTemperatureCelsius: null,
      maximumTemperatureCelsius: null,
      minimumTemperatureCelsius: null,
      averageWindKmh: null,
      maximumWindGustKmh: null,
      totalPrecipitationMm: null,
      maximumPrecipitationMmHour: null,
      averageCloudCoverPercent: null,
      minimumHumidityPercent: null,
      maximumHumidityPercent: null,
      dominantWindDirection: 'N/A',
    };
  }

  const averageTemperatureCelsius = average(validSamples, 'temperatureCelsius');
  const totalDistanceMeters =
      validSamples[validSamples.length - 1].cumulativeDistanceMeters || validSamples.length;
  const routeHours = Math.max(totalDistanceMeters / 1000 / 28, 0.1);

  return {
    hasWeather: true,
    averageApparentTemperatureCelsius:
        average(validSamples, 'apparentTemperatureCelsius'),
    averageTemperatureCelsius,
    maximumTemperatureCelsius: max(validSamples, 'temperatureCelsius'),
    minimumTemperatureCelsius: min(validSamples, 'temperatureCelsius'),
    averageWindKmh: average(validSamples, 'windSpeedKmh'),
    maximumWindGustKmh: max(validSamples, 'windGustKmh'),
    totalPrecipitationMm: average(validSamples, 'precipitationMmHour') * routeHours,
    maximumPrecipitationMmHour: max(validSamples, 'precipitationMmHour'),
    averageCloudCoverPercent: average(validSamples, 'cloudCoverPercent'),
    minimumHumidityPercent: min(validSamples, 'humidityPercent'),
    maximumHumidityPercent: max(validSamples, 'humidityPercent'),
    dominantWindDirection: degreesToCompass(average(validSamples, 'windDirectionDegrees')),
  };
}

/**
 * Gets an average value.
 *
 * @param {!Array<!Object>} samples Samples.
 * @param {string} key Numeric key.
 * @return {number} Average.
 */
function average(samples, key) {
  return samples.reduce((total, sample) => total + sample[key], 0) / samples.length;
}

/**
 * Gets a maximum value.
 *
 * @param {!Array<!Object>} samples Samples.
 * @param {string} key Numeric key.
 * @return {number} Maximum.
 */
function max(samples, key) {
  return Math.max(...samples.map((sample) => sample[key]));
}

/**
 * Gets a minimum value.
 *
 * @param {!Array<!Object>} samples Samples.
 * @param {string} key Numeric key.
 * @return {number} Minimum.
 */
function min(samples, key) {
  return Math.min(...samples.map((sample) => sample[key]));
}

/**
 * Converts wind direction degrees to a compass label.
 *
 * @param {number} degrees Wind direction degrees.
 * @return {string} Compass label.
 */
function degreesToCompass(degrees) {
  const directions = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ];
  const index = Math.round((degrees % 360) / 22.5) % directions.length;

  return directions[index];
}
