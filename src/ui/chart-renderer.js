import {clamp} from '../core/geo.js';

const CHART_PADDING = {
  top: 22,
  right: 58,
  bottom: 34,
  left: 54,
};
const GRADE_WINDOW_METERS = 120;

/**
 * Draws the elevation and weather profile.
 *
 * @param {!HTMLCanvasElement} canvas Canvas.
 * @param {!Array<!Object>} track Route track.
 * @param {!Array<!Object>} weatherSamples Weather samples.
 * @param {{profileMetric: string, showWind: boolean, showTemperature: boolean,
 *     showPrecipitation: boolean}} options Display options.
 */
export function drawElevationChart(canvas, track, weatherSamples, options) {
  const {ctx, width, height} = prepareCanvas(canvas);
  clearCanvas(ctx, width, height);
  drawPanelBackground(ctx, width, height);

  if (track.length < 2) {
    drawEmptyState(ctx, width, height, 'Add route points');
    return;
  }

  const plot = createPlotBounds(width, height);
  const elevationValues = track
      .map((point) => point.elevationMeters)
      .filter((elevationMeters) => Number.isFinite(elevationMeters));

  if (elevationValues.length !== track.length) {
    drawEmptyState(ctx, width, height, 'Elevation unavailable');
    return;
  }

  const maxElevation = Math.max(...elevationValues);
  const minElevation = Math.min(...elevationValues);
  const totalDistanceMeters = track[track.length - 1].cumulativeDistanceMeters || 1;

  if (options.profileMetric === 'grade') {
    const gradeProfile = createGradeProfile(track);
    const maxAbsGrade = Math.max(
        6,
        Math.ceil(Math.max(...gradeProfile.map((point) => Math.abs(point.gradePercent)))));

    drawGrid(ctx, plot, {
      yMin: -maxAbsGrade,
      yMax: maxAbsGrade,
      unit: '%',
    });
    drawGradeArea(ctx, plot, gradeProfile, maxAbsGrade, totalDistanceMeters);
  } else {
    drawGrid(ctx, plot, {
      yMin: minElevation,
      yMax: maxElevation,
      unit: 'm',
    });
    drawElevationArea(ctx, plot, track, minElevation, maxElevation, totalDistanceMeters);
  }

  if (options.showWind) {
    drawWindVectors(ctx, plot, weatherSamples, totalDistanceMeters);
  }

  if (options.showTemperature) {
    drawMetricLine(ctx, plot, weatherSamples, totalDistanceMeters, {
      key: 'temperatureCelsius',
      color: '#ff5c65',
      min: 0,
      max: 30,
    });
  }

  if (options.showPrecipitation) {
    drawMetricLine(ctx, plot, weatherSamples, totalDistanceMeters, {
      key: 'precipitationMmHour',
      color: '#5ba7ff',
      min: 0,
      max: 2.5,
    });
  }

  drawXAxis(ctx, plot, totalDistanceMeters);

  if (options.showWind) {
    drawWindScale(ctx, width, height);
  }
}

/**
 * Draws the compact weather timeline.
 *
 * @param {!HTMLCanvasElement} canvas Canvas.
 * @param {!Array<!Object>} weatherSamples Weather samples.
 */
export function drawWeatherTimeline(canvas, weatherSamples) {
  const {ctx, width, height} = prepareCanvas(canvas);
  clearCanvas(ctx, width, height);
  drawPanelBackground(ctx, width, height);

  if (weatherSamples.length < 2) {
    drawEmptyState(ctx, width, height, 'No weather data');
    return;
  }

  if (!weatherSamples.some((sample) => Number.isFinite(sample.temperatureCelsius))) {
    drawEmptyState(ctx, width, height, 'Weather unavailable');
    return;
  }

  const plot = {
    left: 34,
    top: 22,
    right: width - 28,
    bottom: height - 26,
    width: width - 62,
    height: height - 48,
  };
  const totalDistanceMeters =
      weatherSamples[weatherSamples.length - 1].cumulativeDistanceMeters || 1;

  drawMiniGrid(ctx, plot);
  drawMetricLine(ctx, plot, weatherSamples, totalDistanceMeters, {
    key: 'temperatureCelsius',
    color: '#ff5c65',
    min: 0,
    max: 30,
  });
  drawMetricLine(ctx, plot, weatherSamples, totalDistanceMeters, {
    key: 'windSpeedKmh',
    color: '#70d468',
    min: 0,
    max: 65,
  });
  drawMetricLine(ctx, plot, weatherSamples, totalDistanceMeters, {
    key: 'precipitationMmHour',
    color: '#5ba7ff',
    min: 0,
    max: 2.5,
  });
  drawMetricLine(ctx, plot, weatherSamples, totalDistanceMeters, {
    key: 'cloudCoverPercent',
    color: '#a9b5c7',
    min: 0,
    max: 100,
  });
}

/**
 * Prepares a high-DPI canvas.
 *
 * @param {!HTMLCanvasElement} canvas Canvas.
 * @return {{ctx: !CanvasRenderingContext2D, width: number, height: number}}
 */
function prepareCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  return {ctx, width, height};
}

/**
 * Clears canvas.
 *
 * @param {!CanvasRenderingContext2D} ctx Canvas context.
 * @param {number} width Width.
 * @param {number} height Height.
 */
function clearCanvas(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
}

/**
 * Draws chart background.
 *
 * @param {!CanvasRenderingContext2D} ctx Canvas context.
 * @param {number} width Width.
 * @param {number} height Height.
 */
function drawPanelBackground(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, 'rgba(21, 39, 57, 0.94)');
  gradient.addColorStop(1, 'rgba(8, 20, 32, 0.96)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Creates plot dimensions.
 *
 * @param {number} width Canvas width.
 * @param {number} height Canvas height.
 * @return {!Object} Plot bounds.
 */
function createPlotBounds(width, height) {
  return {
    left: CHART_PADDING.left,
    top: CHART_PADDING.top,
    right: width - CHART_PADDING.right,
    bottom: height - CHART_PADDING.bottom,
    width: width - CHART_PADDING.left - CHART_PADDING.right,
    height: height - CHART_PADDING.top - CHART_PADDING.bottom,
  };
}

/**
 * Draws the chart grid and axis labels.
 *
 * @param {!CanvasRenderingContext2D} ctx Canvas context.
 * @param {!Object} plot Plot bounds.
 * @param {!Object} config Grid config.
 */
function drawGrid(ctx, plot, config) {
  ctx.strokeStyle = 'rgba(151, 168, 191, 0.16)';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#a9b5c7';
  ctx.font = '12px Inter, system-ui, sans-serif';

  for (let index = 0; index <= 4; index += 1) {
    const ratio = index / 4;
    const y = plot.bottom - ratio * plot.height;
    const value = Math.round(config.yMin + (config.yMax - config.yMin) * ratio);

    ctx.beginPath();
    ctx.moveTo(plot.left, y);
    ctx.lineTo(plot.right, y);
    ctx.stroke();
    ctx.fillText(`${value.toLocaleString()} ${config.unit}`, 8, y + 4);
  }
}

/**
 * Draws a compact grid.
 *
 * @param {!CanvasRenderingContext2D} ctx Canvas context.
 * @param {!Object} plot Plot bounds.
 */
function drawMiniGrid(ctx, plot) {
  ctx.strokeStyle = 'rgba(151, 168, 191, 0.15)';
  ctx.lineWidth = 1;

  for (let index = 0; index <= 3; index += 1) {
    const y = plot.top + index / 3 * plot.height;
    ctx.beginPath();
    ctx.moveTo(plot.left, y);
    ctx.lineTo(plot.right, y);
    ctx.stroke();
  }

  for (let index = 0; index <= 4; index += 1) {
    const x = plot.left + index / 4 * plot.width;
    ctx.beginPath();
    ctx.moveTo(x, plot.top);
    ctx.lineTo(x, plot.bottom);
    ctx.stroke();
  }
}

/**
 * Draws elevation profile.
 *
 * @param {!CanvasRenderingContext2D} ctx Canvas context.
 * @param {!Object} plot Plot bounds.
 * @param {!Array<!Object>} track Route track.
 * @param {number} minElevation Minimum elevation.
 * @param {number} maxElevation Maximum elevation.
 * @param {number} totalDistanceMeters Total distance.
 */
function drawElevationArea(ctx, plot, track, minElevation, maxElevation, totalDistanceMeters) {
  const elevationRange = Math.max(1, maxElevation - minElevation);
  const gradient = ctx.createLinearGradient(0, plot.top, 0, plot.bottom);
  gradient.addColorStop(0, 'rgba(245, 158, 11, 0.95)');
  gradient.addColorStop(0.45, 'rgba(132, 204, 22, 0.82)');
  gradient.addColorStop(1, 'rgba(14, 165, 233, 0.56)');

  ctx.beginPath();
  track.forEach((point, index) => {
    const x = plot.left +
        (point.cumulativeDistanceMeters / totalDistanceMeters) * plot.width;
    const y = plot.bottom -
        ((point.elevationMeters - minElevation) / elevationRange) * plot.height;

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.lineTo(plot.right, plot.bottom);
  ctx.lineTo(plot.left, plot.bottom);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  track.forEach((point, index) => {
    const x = plot.left +
        (point.cumulativeDistanceMeters / totalDistanceMeters) * plot.width;
    const y = plot.bottom -
        ((point.elevationMeters - minElevation) / elevationRange) * plot.height;

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.strokeStyle = '#f8b12c';
  ctx.lineWidth = 2;
  ctx.stroke();
}

/**
 * Draws grade profile around a zero baseline.
 *
 * @param {!CanvasRenderingContext2D} ctx Canvas context.
 * @param {!Object} plot Plot bounds.
 * @param {!Array<!Object>} gradeProfile Grade points.
 * @param {number} maxAbsGrade Maximum absolute grade.
 * @param {number} totalDistanceMeters Total distance.
 */
function drawGradeArea(ctx, plot, gradeProfile, maxAbsGrade, totalDistanceMeters) {
  const zeroY = plot.top + plot.height / 2;
  ctx.strokeStyle = 'rgba(244, 247, 251, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plot.left, zeroY);
  ctx.lineTo(plot.right, zeroY);
  ctx.stroke();

  drawGradeFill(ctx, plot, gradeProfile, maxAbsGrade, totalDistanceMeters, true, zeroY);
  drawGradeFill(ctx, plot, gradeProfile, maxAbsGrade, totalDistanceMeters, false, zeroY);

  ctx.beginPath();
  gradeProfile.forEach((point, index) => {
    const x = plot.left +
        (point.cumulativeDistanceMeters / totalDistanceMeters) * plot.width;
    const y = gradeToY(plot, point.gradePercent, maxAbsGrade);

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.strokeStyle = '#f8b12c';
  ctx.lineWidth = 2;
  ctx.stroke();
}

/**
 * Draws positive or negative grade fill.
 *
 * @param {!CanvasRenderingContext2D} ctx Canvas context.
 * @param {!Object} plot Plot bounds.
 * @param {!Array<!Object>} gradeProfile Grade points.
 * @param {number} maxAbsGrade Maximum absolute grade.
 * @param {number} totalDistanceMeters Total distance.
 * @param {boolean} isPositive Whether to draw positive grade.
 * @param {number} zeroY Zero baseline y-position.
 */
function drawGradeFill(ctx, plot, gradeProfile, maxAbsGrade, totalDistanceMeters, isPositive, zeroY) {
  ctx.beginPath();
  ctx.moveTo(plot.left, zeroY);

  gradeProfile.forEach((point) => {
    const x = plot.left +
        (point.cumulativeDistanceMeters / totalDistanceMeters) * plot.width;
    const gradePercent = isPositive ?
      Math.max(0, point.gradePercent) :
      Math.min(0, point.gradePercent);
    const y = gradeToY(plot, gradePercent, maxAbsGrade);
    ctx.lineTo(x, y);
  });

  ctx.lineTo(plot.right, zeroY);
  ctx.closePath();
  ctx.fillStyle = isPositive ?
    'rgba(245, 158, 11, 0.52)' :
    'rgba(14, 165, 233, 0.40)';
  ctx.fill();
}

/**
 * Converts a grade value to a y-coordinate.
 *
 * @param {!Object} plot Plot bounds.
 * @param {number} gradePercent Grade percent.
 * @param {number} maxAbsGrade Maximum absolute grade.
 * @return {number} Y-coordinate.
 */
function gradeToY(plot, gradePercent, maxAbsGrade) {
  const ratio = (clamp(gradePercent, -maxAbsGrade, maxAbsGrade) + maxAbsGrade) /
      (maxAbsGrade * 2);

  return plot.bottom - ratio * plot.height;
}

/**
 * Creates a distance-windowed grade profile.
 *
 * @param {!Array<!Object>} track Route track.
 * @return {!Array<!Object>} Grade profile.
 */
function createGradeProfile(track) {
  return track.map((point) => {
    const startDistanceMeters = Math.max(
        0,
        point.cumulativeDistanceMeters - GRADE_WINDOW_METERS);
    const endDistanceMeters = Math.min(
        track[track.length - 1].cumulativeDistanceMeters,
        point.cumulativeDistanceMeters + GRADE_WINDOW_METERS);
    const startPoint = findTrackPointAtDistance(track, startDistanceMeters);
    const endPoint = findTrackPointAtDistance(track, endDistanceMeters);
    const distanceMeters =
        endPoint.cumulativeDistanceMeters - startPoint.cumulativeDistanceMeters;
    const gradePercent = distanceMeters > 0 ?
      (endPoint.elevationMeters - startPoint.elevationMeters) / distanceMeters * 100 :
      0;

    return {
      cumulativeDistanceMeters: point.cumulativeDistanceMeters,
      gradePercent: clamp(gradePercent, -35, 35),
    };
  });
}

/**
 * Finds an interpolated route point at a distance.
 *
 * @param {!Array<!Object>} track Route track.
 * @param {number} targetDistanceMeters Target distance.
 * @return {!Object} Interpolated point.
 */
function findTrackPointAtDistance(track, targetDistanceMeters) {
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
        cumulativeDistanceMeters: targetDistanceMeters,
        elevationMeters: previousPoint.elevationMeters +
            (nextPoint.elevationMeters - previousPoint.elevationMeters) *
                clamp(ratio, 0, 1),
      };
    }
  }

  return track[track.length - 1];
}

/**
 * Draws an overlay metric line.
 *
 * @param {!CanvasRenderingContext2D} ctx Canvas context.
 * @param {!Object} plot Plot bounds.
 * @param {!Array<!Object>} samples Samples.
 * @param {number} totalDistanceMeters Total route distance.
 * @param {!Object} config Metric config.
 */
function drawMetricLine(ctx, plot, samples, totalDistanceMeters, config) {
  if (!samples.some((sample) => Number.isFinite(sample[config.key]))) {
    return;
  }

  ctx.beginPath();
  let hasStartedLine = false;
  samples.forEach((sample, index) => {
    if (!Number.isFinite(sample[config.key])) {
      hasStartedLine = false;
      return;
    }

    const x = plot.left +
        (sample.cumulativeDistanceMeters / totalDistanceMeters) * plot.width;
    const ratio = clamp((sample[config.key] - config.min) / (config.max - config.min), 0, 1);
    const y = plot.bottom - ratio * plot.height;

    if (!hasStartedLine || index === 0) {
      ctx.moveTo(x, y);
      hasStartedLine = true;
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.strokeStyle = config.color;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/**
 * Draws wind vector marks.
 *
 * @param {!CanvasRenderingContext2D} ctx Canvas context.
 * @param {!Object} plot Plot bounds.
 * @param {!Array<!Object>} samples Weather samples.
 * @param {number} totalDistanceMeters Total route distance.
 */
function drawWindVectors(ctx, plot, samples, totalDistanceMeters) {
  const step = Math.max(1, Math.floor(samples.length / 42));

  for (let index = 0; index < samples.length; index += step) {
    const sample = samples[index];

    if (!Number.isFinite(sample.windSpeedKmh) ||
        !Number.isFinite(sample.windDirectionDegrees)) {
      continue;
    }
    const x = plot.left + (sample.cumulativeDistanceMeters / totalDistanceMeters) * plot.width;
    const band = (index / step) % 5;
    const y = plot.top + 18 + band * (plot.height / 5);
    const length = 7 + sample.windSpeedKmh / 6;
    const angle = (sample.windDirectionDegrees - 90) * Math.PI / 180;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = windColor(sample.windSpeedKmh);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-length / 2, 0);
    ctx.lineTo(length / 2, 0);
    ctx.lineTo(length / 2 - 4, -3);
    ctx.moveTo(length / 2, 0);
    ctx.lineTo(length / 2 - 4, 3);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Draws x-axis distance labels.
 *
 * @param {!CanvasRenderingContext2D} ctx Canvas context.
 * @param {!Object} plot Plot bounds.
 * @param {number} totalDistanceMeters Total route distance.
 */
function drawXAxis(ctx, plot, totalDistanceMeters) {
  ctx.fillStyle = '#b8c4d4';
  ctx.font = '12px Inter, system-ui, sans-serif';

  for (let index = 0; index <= 6; index += 1) {
    const ratio = index / 6;
    const x = plot.left + ratio * plot.width;
    const label = `${Math.round(totalDistanceMeters * ratio / 1000)} km`;
    ctx.fillText(label, x - 12, plot.bottom + 23);
  }
}

/**
 * Draws color scale.
 *
 * @param {!CanvasRenderingContext2D} ctx Canvas context.
 * @param {number} width Canvas width.
 * @param {number} height Canvas height.
 */
function drawWindScale(ctx, width, height) {
  const x = width - 36;
  const top = 54;
  const scaleHeight = height - 92;
  const gradient = ctx.createLinearGradient(0, top + scaleHeight, 0, top);
  gradient.addColorStop(0, '#5b91e7');
  gradient.addColorStop(0.28, '#4ad391');
  gradient.addColorStop(0.5, '#f4d62a');
  gradient.addColorStop(0.72, '#ff8d1c');
  gradient.addColorStop(1, '#ec2e32');
  ctx.fillStyle = gradient;
  ctx.fillRect(x, top, 14, scaleHeight);
  ctx.fillStyle = '#b8c4d4';
  ctx.font = '12px Inter, system-ui, sans-serif';
  ctx.fillText('60', x + 22, top + 5);
  ctx.fillText('45', x + 22, top + scaleHeight * 0.28);
  ctx.fillText('30', x + 22, top + scaleHeight * 0.5);
  ctx.fillText('15', x + 22, top + scaleHeight * 0.72);
  ctx.fillText('0', x + 22, top + scaleHeight);
}

/**
 * Builds distance labels.
 *
 * @param {number} totalDistanceMeters Total distance.
 * @return {!Array<string>} Labels.
 */
function buildDistanceLabels(totalDistanceMeters) {
  return [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    return `${Math.round(totalDistanceMeters * ratio / 1000)} km`;
  });
}

/**
 * Gets a wind color.
 *
 * @param {number} speed Wind speed.
 * @return {string} CSS color.
 */
function windColor(speed) {
  if (speed >= 45) {
    return '#ec2e32';
  }

  if (speed >= 30) {
    return '#ffbf2f';
  }

  if (speed >= 15) {
    return '#4ad391';
  }

  return '#5b91e7';
}

/**
 * Draws an empty state.
 *
 * @param {!CanvasRenderingContext2D} ctx Canvas context.
 * @param {number} width Canvas width.
 * @param {number} height Canvas height.
 * @param {string} label Label.
 */
function drawEmptyState(ctx, width, height, label) {
  ctx.fillStyle = '#8ea0b7';
  ctx.font = '14px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, width / 2, height / 2);
  ctx.textAlign = 'left';
}
