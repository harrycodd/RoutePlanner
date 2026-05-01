import {interpolateTrack} from '../core/geo.js';

const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1';
const OSRM_PROFILE = 'driving';

export class RoutingService {
  /**
   * Creates a routable track from user waypoints.
   *
   * @param {!Array<{lat: number, lng: number}>} waypoints User waypoints.
   * @param {{snapToRoads: boolean}=} options Routing options.
   * @return {!Promise<{track: !Array<{lat: number, lng: number}>,
   *     snapped: boolean, message: string}>}
   */
  async buildTrack(waypoints, options = {snapToRoads: true}) {
    if (waypoints.length < 2) {
      return {
        track: [...waypoints],
        snapped: false,
        message: '',
      };
    }

    if (!options.snapToRoads) {
      return {
        track: interpolateTrack(waypoints),
        snapped: false,
        message: 'Using direct route segments.',
      };
    }

    try {
      const track = await this.fetchOsrmTrack(waypoints);

      return {
        track,
        snapped: true,
        message: 'Route snapped to mapped roads.',
      };
    } catch (error) {
      return {
        track: interpolateTrack(waypoints),
        snapped: false,
        message: 'Road snap unavailable. Using direct route segments.',
      };
    }
  }

  /**
   * Fetches a track from OSRM.
   *
   * @param {!Array<{lat: number, lng: number}>} waypoints User waypoints.
   * @return {!Promise<!Array<{lat: number, lng: number}>>}
   */
  async fetchOsrmTrack(waypoints) {
    const coordinates = waypoints
        .map((point) => `${point.lng.toFixed(6)},${point.lat.toFixed(6)}`)
        .join(';');
    const url = `${OSRM_BASE_URL}/${OSRM_PROFILE}/${coordinates}?overview=full&geometries=geojson`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`OSRM request failed: ${response.status}`);
    }

    const payload = await response.json();
    const route = payload.routes?.[0];

    if (!route?.geometry?.coordinates?.length) {
      throw new Error('OSRM response did not include a route.');
    }

    return route.geometry.coordinates.map(([lng, lat]) => ({lat, lng}));
  }
}
