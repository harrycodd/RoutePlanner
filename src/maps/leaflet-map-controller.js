import {clamp} from '../core/geo.js';

const DEFAULT_ZOOM = 12;
const ROUTE_WEIGHT = 7;

export class LeafletMapController {
  /**
   * Creates the map controller.
   *
   * @param {{containerId: string, center: {lat: number, lng: number},
   *     onMapClick: function(!Object), onWaypointMoved: function(number, !Object)}} config
   */
  constructor(config) {
    this.config = config;
    this.map = null;
    this.routeLayer = null;
    this.markerLayer = null;
    this.resizeObserver = null;
  }

  /**
   * Initializes Leaflet and base map tiles.
   */
  initialize() {
    if (!window.L) {
      throw new Error('Leaflet failed to load.');
    }

    this.map = window.L.map(this.config.containerId, {
      attributionControl: true,
      zoomControl: false,
      preferCanvas: true,
    }).setView([this.config.center.lat, this.config.center.lng], DEFAULT_ZOOM);

    window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      crossOrigin: true,
      keepBuffer: 4,
      updateWhenIdle: false,
      updateWhenZooming: false,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);

    window.L.control.zoom({position: 'bottomright'}).addTo(this.map);
    this.routeLayer = window.L.layerGroup().addTo(this.map);
    this.markerLayer = window.L.layerGroup().addTo(this.map);
    this.map.on('click', (event) => {
      this.config.onMapClick({
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      });
    });

    this.observeContainerSize();
    this.scheduleRefresh();
  }

  /**
   * Renders route geometry and waypoints.
   *
   * @param {{waypoints: !Array<!Object>, track: !Array<!Object>,
   *     weatherSamples: !Array<!Object>}} routeView Route view state.
   */
  setRoute(routeView) {
    this.routeLayer.clearLayers();
    this.markerLayer.clearLayers();

    this.drawTrack(routeView.track, routeView.weatherSamples);
    this.drawWaypoints(routeView.waypoints);
    this.scheduleRefresh();
  }

  /**
   * Fits the viewport to the route.
   *
   * @param {!Array<{lat: number, lng: number}>} points Points to fit.
   */
  fitToPoints(points) {
    this.refreshSize();

    if (!points.length) {
      this.map.setView([this.config.center.lat, this.config.center.lng], DEFAULT_ZOOM);
      this.scheduleRefresh();
      return;
    }

    const bounds = window.L.latLngBounds(points.map((point) => [point.lat, point.lng]));
    this.map.fitBounds(bounds.pad(0.18), {
      animate: true,
      maxZoom: 14,
    });
    this.scheduleRefresh();
  }

  /**
   * Invalidates the map size after layout changes.
   */
  refreshSize() {
    if (this.map) {
      this.map.invalidateSize({pan: false});
    }
  }

  /**
   * Schedules size refreshes after layout and tile work has settled.
   */
  scheduleRefresh() {
    window.requestAnimationFrame(() => {
      this.refreshSize();
      window.setTimeout(() => this.refreshSize(), 80);
      window.setTimeout(() => this.refreshSize(), 260);
    });
  }

  /**
   * Watches the map container for size changes.
   */
  observeContainerSize() {
    const container = document.getElementById(this.config.containerId);

    if (!container || !window.ResizeObserver) {
      return;
    }

    this.resizeObserver = new ResizeObserver(() => this.scheduleRefresh());
    this.resizeObserver.observe(container);
  }

  /**
   * Draws the analyzed track.
   *
   * @param {!Array<!Object>} track Track points.
   * @param {!Array<!Object>} weatherSamples Weather samples.
   */
  drawTrack(track, weatherSamples) {
    if (track.length < 2) {
      return;
    }

    for (let index = 1; index < track.length; index += 1) {
      const sample = weatherSamples[index] || weatherSamples[index - 1] || {};
      const segment = [
        [track[index - 1].lat, track[index - 1].lng],
        [track[index].lat, track[index].lng],
      ];

      window.L.polyline(segment, {
        color: getWindColor(sample.windSpeedKmh || 0),
        opacity: 0.96,
        weight: ROUTE_WEIGHT,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(this.routeLayer);
    }

    this.drawEndpoint(track[0], 'start');
    this.drawEndpoint(track[track.length - 1], 'finish');
  }

  /**
   * Draws editable waypoints.
   *
   * @param {!Array<{lat: number, lng: number}>} waypoints Waypoints.
   */
  drawWaypoints(waypoints) {
    waypoints.forEach((point, index) => {
      const marker = window.L.marker([point.lat, point.lng], {
        draggable: true,
        icon: window.L.divIcon({
          className: 'waypoint-icon-shell',
          html: `<span class="waypoint-icon">${index + 1}</span>`,
          iconAnchor: [14, 14],
          iconSize: [28, 28],
        }),
      }).addTo(this.markerLayer);

      marker.on('dragend', () => {
        const nextPosition = marker.getLatLng();
        this.config.onWaypointMoved(index, {
          lat: nextPosition.lat,
          lng: nextPosition.lng,
        });
      });
    });
  }

  /**
   * Draws start or finish marker.
   *
   * @param {{lat: number, lng: number}} point Point.
   * @param {string} type Marker type.
   */
  drawEndpoint(point, type) {
    const iconName = type === 'start' ? 'play' : 'flag';

    window.L.marker([point.lat, point.lng], {
      interactive: false,
      icon: window.L.divIcon({
        className: 'endpoint-icon-shell',
        html: `<span class="endpoint-icon endpoint-icon-${type}"><i data-lucide="${iconName}"></i></span>`,
        iconAnchor: [16, 16],
        iconSize: [32, 32],
      }),
    }).addTo(this.routeLayer);

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }
}

/**
 * Maps wind speed to a route color.
 *
 * @param {number} windSpeedKmh Wind speed.
 * @return {string} Hex color.
 */
function getWindColor(windSpeedKmh) {
  const ratio = clamp(windSpeedKmh / 60, 0, 1);
  const stops = [
    [0.0, [82, 148, 255]],
    [0.28, [74, 211, 145]],
    [0.5, [244, 214, 42]],
    [0.72, [255, 141, 28]],
    [1.0, [236, 46, 50]],
  ];

  for (let index = 1; index < stops.length; index += 1) {
    const [stopRatio, stopColor] = stops[index];
    const [previousRatio, previousColor] = stops[index - 1];

    if (ratio <= stopRatio) {
      const localRatio = (ratio - previousRatio) / (stopRatio - previousRatio);
      const color = stopColor.map((channel, channelIndex) => {
        return Math.round(previousColor[channelIndex] +
            (channel - previousColor[channelIndex]) * localRatio);
      });

      return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    }
  }

  return 'rgb(236, 46, 50)';
}
