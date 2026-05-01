import {
  addHoursToSelection,
  createHourOptions,
  formatHourLabel,
  getMaxForecastDateValue,
  getTodayInputValue,
  normalizeHour,
} from '../core/date-time.js';
import {
  formatDistanceKilometers,
  formatDuration,
} from '../core/geo.js';

export class DashboardController {
  /**
   * Creates a dashboard controller.
   */
  constructor() {
    this.elements = {
      activitySelect: document.querySelector('#activity-select'),
      clearRouteButton: document.querySelector('#clear-route-button'),
      distanceStat: document.querySelector('#distance-stat'),
      editRouteButton: document.querySelector('#edit-route-button'),
      elevationChart: document.querySelector('#elevation-chart'),
      exportGpxButton: document.querySelector('#export-gpx-button'),
      fitRouteButton: document.querySelector('#fit-route-button'),
      gainStat: document.querySelector('#gain-stat'),
      loadDemoButton: document.querySelector('#load-demo-button'),
      newRouteButton: document.querySelector('#new-route-button'),
      nextWeatherHourButton: document.querySelector('#next-weather-hour-button'),
      profileElevationButton: document.querySelector('#profile-elevation-button'),
      profileGradeButton: document.querySelector('#profile-grade-button'),
      profileTitle: document.querySelector('#profile-title'),
      previousWeatherHourButton: document.querySelector('#previous-weather-hour-button'),
      renameRouteButton: document.querySelector('#rename-route-button'),
      routeDetails: document.querySelector('#route-details'),
      routeStatus: document.querySelector('#route-status'),
      routeTitle: document.querySelector('#route-title'),
      showPrecipToggle: document.querySelector('#show-precip-toggle'),
      showTempToggle: document.querySelector('#show-temp-toggle'),
      showWindToggle: document.querySelector('#show-wind-toggle'),
      snapToggle: document.querySelector('#snap-toggle'),
      surfaceBreakdown: document.querySelector('#surface-breakdown'),
      timeStat: document.querySelector('#time-stat'),
      undoPointButton: document.querySelector('#undo-point-button'),
      weatherCards: document.querySelector('#weather-cards'),
      weatherChart: document.querySelector('#weather-chart'),
      weatherDateInput: document.querySelector('#weather-date-input'),
      weatherTimeSelect: document.querySelector('#weather-time-select'),
    };
    this.initializeWeatherControls();
  }

  /**
   * Returns the route title.
   *
   * @return {string} Route title.
   */
  getRouteTitle() {
    return this.elements.routeTitle.textContent.trim();
  }

  /**
   * Returns selected activity.
   *
   * @return {string} Activity id.
   */
  getActivity() {
    return this.elements.activitySelect.value;
  }

  /**
   * Returns chart display options.
   *
   * @return {!Object} Chart options.
   */
  getChartOptions() {
    return {
      profileMetric: this.getProfileMetric(),
      showWind: this.elements.showWindToggle.checked,
      showTemperature: this.elements.showTempToggle.checked,
      showPrecipitation: this.elements.showPrecipToggle.checked,
    };
  }

  /**
   * Returns whether road snapping is enabled.
   *
   * @return {boolean} Whether road snapping is enabled.
   */
  shouldSnapToRoads() {
    return this.elements.snapToggle.checked;
  }

  /**
   * Returns the active profile metric.
   *
   * @return {string} Profile metric.
   */
  getProfileMetric() {
    return this.elements.profileGradeButton.classList.contains('is-active') ?
      'grade' :
      'elevation';
  }

  /**
   * Sets the active profile metric.
   *
   * @param {string} profileMetric Profile metric.
   */
  setProfileMetric(profileMetric) {
    const isGrade = profileMetric === 'grade';
    this.elements.profileElevationButton.classList.toggle('is-active', !isGrade);
    this.elements.profileGradeButton.classList.toggle('is-active', isGrade);
    this.elements.profileElevationButton.setAttribute('aria-selected', String(!isGrade));
    this.elements.profileGradeButton.setAttribute('aria-selected', String(isGrade));
    this.elements.profileTitle.textContent = isGrade ? 'Grade (%)' : 'Wind (km/h)';
  }

  /**
   * Returns selected weather date and hour.
   *
   * @return {{date: string, hour: number}} Weather selection.
   */
  getWeatherSelection() {
    return {
      date: this.elements.weatherDateInput.value || getTodayInputValue(),
      hour: normalizeHour(this.elements.weatherTimeSelect.value),
    };
  }

  /**
   * Sets selected weather date and hour.
   *
   * @param {{date: string, hour: number}} selection Weather selection.
   */
  setWeatherSelection(selection) {
    this.elements.weatherDateInput.value = selection.date;
    this.elements.weatherTimeSelect.value = String(normalizeHour(selection.hour));
    this.elements.weatherTimeSelect.setAttribute(
        'aria-label',
        `Forecast time, ${formatHourLabel(selection.hour)}`);
  }

  /**
   * Moves the weather selection by an hour.
   *
   * @param {number} deltaHours Hour delta.
   * @return {{date: string, hour: number}} Updated selection.
   */
  shiftWeatherSelection(deltaHours) {
    const selection = this.getWeatherSelection();
    const nextSelection = addHoursToSelection(
        selection.date,
        selection.hour,
        deltaHours);
    this.setWeatherSelection(nextSelection);

    return nextSelection;
  }

  /**
   * Sets the route title.
   *
   * @param {string} title Route title.
   */
  setRouteTitle(title) {
    this.elements.routeTitle.textContent = title;
  }

  /**
   * Renders route metrics.
   *
   * @param {!Object} metrics Route metrics.
   */
  renderMetrics(metrics) {
    this.elements.distanceStat.textContent =
        formatDistanceKilometers(metrics.distanceMeters);
    this.elements.gainStat.textContent =
        `${metrics.elevationGainMeters.toLocaleString()} m`;
    this.elements.timeStat.textContent = formatDuration(metrics.estimatedSeconds);
  }

  /**
   * Renders weather summaries.
   *
   * @param {!Object} weatherSummary Weather summary.
   */
  renderWeather(weatherSummary) {
    this.elements.weatherCards.innerHTML = [
      {
        label: 'Temperature',
        icon: 'thermometer',
        value: formatWeatherValue(weatherSummary.averageTemperatureCelsius, 'degC'),
        detail: `Feels like ${formatWeatherValue(
            weatherSummary.averageApparentTemperatureCelsius,
            'degC')}`,
      },
      {
        label: 'Wind',
        icon: 'wind',
        value: formatWeatherValue(weatherSummary.averageWindKmh, 'kmh'),
        detail: weatherSummary.dominantWindDirection,
      },
      {
        label: 'Wind Gusts',
        icon: 'wind',
        value: formatWeatherValue(weatherSummary.maximumWindGustKmh, 'kmh'),
        detail: '',
      },
      {
        label: 'Precipitation',
        icon: 'cloud-rain',
        value: formatWeatherValue(weatherSummary.maximumPrecipitationMmHour, 'mmh'),
        detail: '',
      },
      {
        label: 'Cloud Cover',
        icon: 'cloud',
        value: formatWeatherValue(weatherSummary.averageCloudCoverPercent, 'percent'),
        detail: '',
      },
      {
        label: 'Humidity',
        icon: 'droplet',
        value: formatWeatherValue(weatherSummary.maximumHumidityPercent, 'percent'),
        detail: '',
      },
    ].map(createWeatherCard).join('');

    this.refreshIcons();
  }

  /**
   * Renders route details and surface breakdown.
   *
   * @param {!Object} metrics Route metrics.
   */
  renderRouteDetails(metrics) {
    const details = [
      ['Route Type', metrics.routeType],
      ['Distance', formatDistanceKilometers(metrics.distanceMeters)],
      ['Elevation Gain', formatElevationMetric(metrics.elevationGainMeters, metrics.hasElevation)],
      ['Elevation Loss', formatElevationMetric(metrics.elevationLossMeters, metrics.hasElevation)],
      ['Max Elevation', formatElevationMetric(metrics.maxElevationMeters, metrics.hasElevation)],
      ['Est. Time', formatDuration(metrics.estimatedSeconds)],
    ];
    this.elements.routeDetails.innerHTML = details
        .map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`)
        .join('');
    this.elements.surfaceBreakdown.innerHTML = metrics.surfaces
        .map((surface) => {
          const distance = formatDistanceKilometers(surface.distanceMeters);
          const percentage = Math.round(surface.ratio * 100);

          return [
            '<div class="surface-row">',
            `  <span><i style="background:${surface.color}"></i>${surface.name}</span>`,
            '  <span class="surface-track">',
            `    <span style="width:${percentage}%;background:${surface.color}"></span>`,
            '  </span>',
            `  <strong>${percentage}%</strong>`,
            `  <em>${distance}</em>`,
            '</div>',
          ].join('');
        })
        .join('');
  }

  /**
   * Sets transient status text.
   *
   * @param {string} message Status message.
   * @param {string=} tone Status tone.
   */
  setStatus(message, tone = 'neutral') {
    this.elements.routeStatus.textContent = message;
    this.elements.routeStatus.dataset.tone = tone;

    if (message) {
      window.clearTimeout(this.statusTimeout);
      this.statusTimeout = window.setTimeout(() => {
        this.elements.routeStatus.textContent = '';
      }, 3800);
    }
  }

  /**
   * Sets route controls disabled state.
   *
   * @param {boolean} isBusy Whether the app is busy.
   */
  setBusy(isBusy) {
    this.elements.loadDemoButton.disabled = isBusy;
    this.elements.undoPointButton.disabled = isBusy;
    this.elements.clearRouteButton.disabled = isBusy;
    this.elements.exportGpxButton.disabled = isBusy;
    this.elements.weatherDateInput.disabled = isBusy;
    this.elements.weatherTimeSelect.disabled = isBusy;
    this.elements.previousWeatherHourButton.disabled = isBusy;
    this.elements.nextWeatherHourButton.disabled = isBusy;
  }

  /**
   * Refreshes icon SVGs.
   */
  refreshIcons() {
    if (window.lucide) {
      window.lucide.createIcons({
        attrs: {
          'stroke-width': 1.8,
        },
      });
    }
  }

  /**
   * Initializes native date and time controls.
   */
  initializeWeatherControls() {
    this.elements.weatherDateInput.min = getTodayInputValue();
    this.elements.weatherDateInput.max = getMaxForecastDateValue();
    this.elements.weatherTimeSelect.innerHTML = createHourOptions()
        .map((option) => {
          return `<option value="${option.value}">${option.label}</option>`;
        })
        .join('');
    this.setWeatherSelection({
      date: getTodayInputValue(),
      hour: 10,
    });
    this.elements.weatherTimeSelect.setAttribute(
        'aria-label',
        `Forecast time, ${formatHourLabel(this.getWeatherSelection().hour)}`);
  }
}

/**
 * Creates a weather card.
 *
 * @param {!Object} item Card config.
 * @return {string} HTML.
 */
function createWeatherCard(item) {
  return [
    '<article class="weather-card">',
    `  <i data-lucide="${item.icon}"></i>`,
    '  <div>',
    `    <span>${item.label}</span>`,
    `    <strong>${item.value}</strong>`,
    item.detail ? `    <em>${item.detail}</em>` : '',
    '  </div>',
    '</article>',
  ].join('');
}

/**
 * Formats a weather value.
 *
 * @param {number} value Raw value.
 * @param {string} unit Unit.
 * @return {string} Formatted value.
 */
function formatWeatherValue(value, unit) {
  if (!Number.isFinite(value)) {
    return 'N/A';
  }

  if (unit === 'degC') {
    return `${Math.round(value)}°C`;
  }

  if (unit === 'kmh') {
    return `${Math.round(value)} km/h`;
  }

  if (unit === 'mm') {
    return `${value.toFixed(1)} mm`;
  }

  if (unit === 'mmh') {
    return `${value.toFixed(1)} mm/h`;
  }

  if (unit === 'percent') {
    return `${Math.round(value)}%`;
  }

  return String(Math.round(value));
}

/**
 * Formats an elevation metric.
 *
 * @param {?number} value Elevation value.
 * @param {boolean} hasElevation Whether elevation is available.
 * @return {string} Formatted value.
 */
function formatElevationMetric(value, hasElevation) {
  if (!hasElevation || !Number.isFinite(value)) {
    return 'Unavailable';
  }

  return `${Math.round(value).toLocaleString()} m`;
}
