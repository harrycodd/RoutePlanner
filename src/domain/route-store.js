const ROUTE_STORAGE_KEY = 'routeplanner.current-route';

/**
 * Saves current route state.
 *
 * @param {!Object} routeState Route state.
 */
export function saveRouteState(routeState) {
  window.localStorage.setItem(ROUTE_STORAGE_KEY, JSON.stringify(routeState));
}

/**
 * Loads current route state.
 *
 * @return {?Object} Stored route state.
 */
export function loadRouteState() {
  const rawRoute = window.localStorage.getItem(ROUTE_STORAGE_KEY);

  if (!rawRoute) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawRoute);

    if (!Array.isArray(parsed.waypoints)) {
      return null;
    }

    return parsed;
  } catch (error) {
    return null;
  }
}
