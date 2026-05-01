import {
  clampForecastDate,
  getTodayInputValue,
  normalizeHour,
} from '../core/date-time.js';
import {SAMPLE_MAP_CENTER, SAMPLE_ROUTE_NAME, SAMPLE_WAYPOINTS} from '../domain/sample-route.js';
import {calculateRouteMetrics} from '../domain/route-metrics.js';
import {summarizeWeather} from '../domain/weather-model.js';
import {loadRouteState, saveRouteState} from '../domain/route-store.js';
import {LeafletMapController} from '../maps/leaflet-map-controller.js';
import {ElevationService} from '../services/elevation-service.js';
import {RoutingService} from '../services/routing-service.js';
import {WeatherService} from '../services/weather-service.js';
import {
  createGpxDocument,
  createGpxFilename,
  downloadGpx,
} from '../services/gpx-exporter.js';
import {drawElevationChart, drawWeatherTimeline} from '../ui/chart-renderer.js';
import {DashboardController} from '../ui/dashboard-controller.js';

export class AppController {
  /**
   * Creates the application controller.
   */
  constructor() {
    this.dashboard = new DashboardController();
    this.routingService = new RoutingService();
    this.elevationService = new ElevationService();
    this.weatherService = new WeatherService();
    this.requestId = 0;
    this.weatherRequestId = 0;
    this.state = {
      name: SAMPLE_ROUTE_NAME,
      activity: 'ride',
      snapToRoads: true,
      weatherDate: getTodayInputValue(),
      weatherHour: 10,
      waypoints: [...SAMPLE_WAYPOINTS],
      track: [],
      elevationSource: 'none',
      weatherSource: 'none',
      metrics: null,
      weatherSamples: [],
      weatherSummary: null,
    };
    this.mapController = new LeafletMapController({
      containerId: 'route-map',
      center: SAMPLE_MAP_CENTER,
      onMapClick: (point) => this.addWaypoint(point),
      onWaypointMoved: (index, point) => this.moveWaypoint(index, point),
    });
  }

  /**
   * Starts the app.
   */
  async initialize() {
    this.restoreRouteState();
    this.mapController.initialize();
    this.dashboard.setRouteTitle(this.state.name);
    this.dashboard.elements.activitySelect.value = this.state.activity;
    this.dashboard.elements.snapToggle.checked = this.state.snapToRoads;
    this.dashboard.setWeatherSelection({
      date: this.state.weatherDate,
      hour: this.state.weatherHour,
    });
    this.bindEvents();
    this.dashboard.refreshIcons();
    await this.updateRoute({fit: true, showStatus: false});
  }

  /**
   * Binds UI events.
   */
  bindEvents() {
    this.dashboard.elements.loadDemoButton.addEventListener('click', () => {
      this.loadDemoRoute();
    });
    this.dashboard.elements.newRouteButton.addEventListener('click', () => {
      this.clearRoute();
    });
    this.dashboard.elements.clearRouteButton.addEventListener('click', () => {
      this.clearRoute();
    });
    this.dashboard.elements.undoPointButton.addEventListener('click', () => {
      this.undoPoint();
    });
    this.dashboard.elements.fitRouteButton.addEventListener('click', () => {
      this.fitRoute();
    });
    this.dashboard.elements.exportGpxButton.addEventListener('click', () => {
      this.exportGpx();
    });
    this.dashboard.elements.activitySelect.addEventListener('change', () => {
      this.state.activity = this.dashboard.getActivity();
      this.updateRoute({fit: false});
    });
    this.dashboard.elements.snapToggle.addEventListener('change', () => {
      this.state.snapToRoads = this.dashboard.shouldSnapToRoads();
      this.updateRoute({fit: false});
    });
    this.dashboard.elements.weatherDateInput.addEventListener('change', () => {
      this.handleWeatherSelectionChange(this.dashboard.getWeatherSelection());
    });
    this.dashboard.elements.weatherTimeSelect.addEventListener('change', () => {
      this.handleWeatherSelectionChange(this.dashboard.getWeatherSelection());
    });
    this.dashboard.elements.previousWeatherHourButton.addEventListener('click', () => {
      this.handleWeatherSelectionChange(this.dashboard.shiftWeatherSelection(-1));
    });
    this.dashboard.elements.nextWeatherHourButton.addEventListener('click', () => {
      this.handleWeatherSelectionChange(this.dashboard.shiftWeatherSelection(1));
    });
    this.dashboard.elements.profileElevationButton.addEventListener('click', () => {
      this.dashboard.setProfileMetric('elevation');
      this.renderCharts();
    });
    this.dashboard.elements.profileGradeButton.addEventListener('click', () => {
      this.dashboard.setProfileMetric('grade');
      this.renderCharts();
    });
    this.dashboard.elements.renameRouteButton.addEventListener('click', () => {
      this.renameRoute();
    });
    this.dashboard.elements.editRouteButton.addEventListener('click', () => {
      this.dashboard.setStatus('Editing route points on the map.', 'neutral');
    });

    [
      this.dashboard.elements.showWindToggle,
      this.dashboard.elements.showTempToggle,
      this.dashboard.elements.showPrecipToggle,
    ].forEach((control) => {
      control.addEventListener('change', () => this.renderCharts());
    });

    window.addEventListener('resize', () => {
      this.mapController.refreshSize();
      this.renderCharts();
    });
  }

  /**
   * Adds a waypoint.
   *
   * @param {{lat: number, lng: number}} point Waypoint.
   */
  addWaypoint(point) {
    this.state.waypoints = [...this.state.waypoints, point];
    this.updateRoute({fit: false});
  }

  /**
   * Moves an existing waypoint.
   *
   * @param {number} index Waypoint index.
   * @param {{lat: number, lng: number}} point Waypoint.
   */
  moveWaypoint(index, point) {
    this.state.waypoints = this.state.waypoints.map((waypoint, waypointIndex) => {
      return waypointIndex === index ? point : waypoint;
    });
    this.updateRoute({fit: false});
  }

  /**
   * Removes the final waypoint.
   */
  undoPoint() {
    this.state.waypoints = this.state.waypoints.slice(0, -1);
    this.updateRoute({fit: false});
  }

  /**
   * Clears the route.
   */
  clearRoute() {
    this.state.name = 'Untitled Route';
    this.state.waypoints = [];
    this.dashboard.setRouteTitle(this.state.name);
    this.updateRoute({fit: true});
  }

  /**
   * Loads the sample route.
   */
  loadDemoRoute() {
    this.state.name = SAMPLE_ROUTE_NAME;
    this.state.activity = 'ride';
    this.state.waypoints = [...SAMPLE_WAYPOINTS];
    this.dashboard.setRouteTitle(this.state.name);
    this.dashboard.elements.activitySelect.value = this.state.activity;
    this.updateRoute({fit: true});
  }

  /**
   * Renames the route.
   */
  renameRoute() {
    const nextName = window.prompt('Route name', this.state.name);

    if (!nextName?.trim()) {
      return;
    }

    this.state.name = nextName.trim();
    this.dashboard.setRouteTitle(this.state.name);
    this.persistRouteState();
  }

  /**
   * Fits the route in the map viewport.
   */
  fitRoute() {
    const points = this.state.track.length ? this.state.track : this.state.waypoints;
    this.mapController.fitToPoints(points);
  }

  /**
   * Exports the current route as GPX.
   */
  exportGpx() {
    if (this.state.track.length < 2 || !this.state.metrics) {
      this.dashboard.setStatus('Add at least two route points before exporting.', 'warning');
      return;
    }

    const gpx = createGpxDocument({
      name: this.state.name,
      activity: this.state.activity,
      track: this.state.track,
      metrics: this.state.metrics,
      createdAt: new Date(),
    });
    downloadGpx(createGpxFilename(this.state.name), gpx);
    this.dashboard.setStatus('GPX export created.', 'success');
  }

  /**
   * Handles a date/time change for weather forecast data.
   *
   * @param {{date: string, hour: number}} selection Weather selection.
   */
  handleWeatherSelectionChange(selection) {
    this.state.weatherDate = clampForecastDate(selection.date);
    this.state.weatherHour = normalizeHour(selection.hour);
    this.dashboard.setWeatherSelection({
      date: this.state.weatherDate,
      hour: this.state.weatherHour,
    });
    this.persistRouteState();
    this.updateWeather({showStatus: true});
  }

  /**
   * Rebuilds route geometry and analytics.
   *
   * @param {{fit: boolean, showStatus: boolean}=} options Render options.
   */
  async updateRoute(options = {fit: false, showStatus: true}) {
    const requestId = this.requestId + 1;
    this.requestId = requestId;
    this.weatherRequestId += 1;
    this.dashboard.setBusy(true);

    const routeResult = await this.routingService.buildTrack(this.state.waypoints, {
      snapToRoads: this.state.snapToRoads,
    });
    const elevationResult = await this.elevationService.enrichTrack(routeResult.track);
    const weatherResult = await this.weatherService.loadRouteWeather(
        elevationResult.track,
        this.getWeatherSelection());

    if (requestId !== this.requestId) {
      return;
    }

    this.state.track = elevationResult.track;
    this.state.elevationSource = elevationResult.source;
    this.state.weatherSource = weatherResult.source;
    this.state.metrics = calculateRouteMetrics(this.state.track, this.state.activity);
    this.state.weatherSamples = weatherResult.samples;
    this.state.weatherSummary = summarizeWeather(this.state.weatherSamples);
    this.render();
    this.persistRouteState();

    if (options.fit) {
      this.fitRoute();
    }

    if (options.showStatus !== false) {
      this.dashboard.setStatus(
          [routeResult.message, elevationResult.message, weatherResult.message]
              .filter(Boolean)
              .join(' '),
          elevationResult.source === 'unavailable' ||
              weatherResult.source === 'unavailable' ? 'warning' :
            routeResult.snapped ? 'success' : 'neutral');
    }

    this.dashboard.setBusy(false);
  }

  /**
   * Reloads weather for the current route without rebuilding routing/elevation.
   *
   * @param {{showStatus: boolean}=} options Weather update options.
   */
  async updateWeather(options = {showStatus: true}) {
    const weatherRequestId = this.weatherRequestId + 1;
    this.weatherRequestId = weatherRequestId;

    if (this.state.track.length < 2) {
      return;
    }

    this.dashboard.setBusy(true);
    const weatherResult = await this.weatherService.loadRouteWeather(
        this.state.track,
        this.getWeatherSelection());

    if (weatherRequestId !== this.weatherRequestId) {
      return;
    }

    this.state.weatherSource = weatherResult.source;
    this.state.weatherSamples = weatherResult.samples;
    this.state.weatherSummary = summarizeWeather(this.state.weatherSamples);
    this.mapController.setRoute({
      waypoints: this.state.waypoints,
      track: this.state.track,
      weatherSamples: this.state.weatherSamples,
    });
    this.dashboard.renderWeather(this.state.weatherSummary);
    this.renderCharts();
    this.dashboard.setBusy(false);

    if (options.showStatus !== false && weatherResult.message) {
      this.dashboard.setStatus(
          weatherResult.message,
          weatherResult.source === 'unavailable' ? 'warning' : 'success');
    }
  }

  /**
   * Renders all panels.
   */
  render() {
    this.mapController.setRoute({
      waypoints: this.state.waypoints,
      track: this.state.track,
      weatherSamples: this.state.weatherSamples,
    });
    this.dashboard.renderMetrics(this.state.metrics);
    this.dashboard.renderWeather(this.state.weatherSummary);
    this.dashboard.renderRouteDetails(this.state.metrics);
    this.renderCharts();
  }

  /**
   * Renders canvas charts.
   */
  renderCharts() {
    drawElevationChart(
        this.dashboard.elements.elevationChart,
        this.state.track,
        this.state.weatherSamples,
        this.dashboard.getChartOptions());
    drawWeatherTimeline(
        this.dashboard.elements.weatherChart,
        this.state.weatherSamples);
  }

  /**
   * Restores route state from local storage.
   */
  restoreRouteState() {
    const storedRoute = loadRouteState();

    if (!storedRoute) {
      return;
    }

    this.state = {
      ...this.state,
      name: storedRoute.name || this.state.name,
      activity: storedRoute.activity || this.state.activity,
      snapToRoads: storedRoute.snapToRoads ?? this.state.snapToRoads,
      weatherDate: clampForecastDate(storedRoute.weatherDate || this.state.weatherDate),
      weatherHour: normalizeHour(storedRoute.weatherHour ?? this.state.weatherHour),
      waypoints: sanitizeWaypoints(storedRoute.waypoints),
    };
  }

  /**
   * Persists route state to local storage.
   */
  persistRouteState() {
    saveRouteState({
      name: this.state.name,
      activity: this.state.activity,
      snapToRoads: this.state.snapToRoads,
      weatherDate: this.state.weatherDate,
      weatherHour: this.state.weatherHour,
      waypoints: this.state.waypoints,
    });
  }

  /**
   * Returns the weather selection.
   *
   * @return {{date: string, hour: number}} Weather selection.
   */
  getWeatherSelection() {
    return {
      date: this.state.weatherDate,
      hour: this.state.weatherHour,
    };
  }
}

/**
 * Sanitizes waypoints loaded from storage.
 *
 * @param {!Array<!Object>} waypoints Stored waypoints.
 * @return {!Array<{lat: number, lng: number}>} Safe waypoints.
 */
function sanitizeWaypoints(waypoints) {
  return waypoints
      .filter((point) => {
        return point &&
            Number.isFinite(Number(point.lat)) &&
            Number.isFinite(Number(point.lng));
      })
      .map((point) => ({
        lat: Number(point.lat),
        lng: Number(point.lng),
      }));
}
