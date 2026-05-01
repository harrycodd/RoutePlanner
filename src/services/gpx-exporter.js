/**
 * Creates a GPX document from a route.
 *
 * @param {{name: string, activity: string, track: !Array<!Object>,
 *     metrics: !Object, createdAt: !Date}=} route Route export payload.
 * @return {string} GPX XML.
 */
export function createGpxDocument(route) {
  const createdAt = route.createdAt || new Date();
  const routeName = escapeXml(route.name || 'RoutePlanner Route');
  const totalDistanceMeters = route.metrics?.distanceMeters || 1;
  const estimatedSeconds = route.metrics?.estimatedSeconds || route.track.length * 30;
  const trackPoints = route.track.map((point) => {
    const elapsedRatio = totalDistanceMeters > 0 ?
      (point.cumulativeDistanceMeters || 0) / totalDistanceMeters :
      0;
    const pointTime = new Date(createdAt.getTime() + elapsedRatio * estimatedSeconds * 1000);

    const elevationLine = Number.isFinite(point.elevationMeters) ?
      `        <ele>${Math.round(point.elevationMeters)}</ele>` :
      '';
    const pointLines = [
      `      <trkpt lat="${point.lat.toFixed(7)}" lon="${point.lng.toFixed(7)}">`,
      elevationLine,
      `        <time>${pointTime.toISOString()}</time>`,
      '      </trkpt>',
    ].filter(Boolean);

    return pointLines.join('\n');
  }).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="RoutePlanner"',
    '    xmlns="http://www.topografix.com/GPX/1/1"',
    '    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '    xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">',
    `  <metadata><name>${routeName}</name><time>${createdAt.toISOString()}</time></metadata>`,
    '  <trk>',
    `    <name>${routeName}</name>`,
    `    <type>${escapeXml(route.activity || 'ride')}</type>`,
    '    <trkseg>',
    trackPoints,
    '    </trkseg>',
    '  </trk>',
    '</gpx>',
  ].join('\n');
}

/**
 * Downloads text as a GPX file.
 *
 * @param {string} filename File name.
 * @param {string} gpxText GPX XML.
 */
export function downloadGpx(filename, gpxText) {
  const blob = new Blob([gpxText], {type: 'application/gpx+xml;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Builds a safe GPX filename.
 *
 * @param {string} routeName Route name.
 * @return {string} File name.
 */
export function createGpxFilename(routeName) {
  const slug = (routeName || 'route')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'route';

  return `${slug}.gpx`;
}

/**
 * Escapes XML text.
 *
 * @param {string} value Raw value.
 * @return {string} Escaped value.
 */
function escapeXml(value) {
  return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&apos;');
}
