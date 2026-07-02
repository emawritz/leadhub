const COORD_RE = /@(-?\d+\.\d+),(-?\d+\.\d+)/;

export function parseCoordinates(url: string): string {
  const m = url.match(COORD_RE);
  return m ? `${m[1]},${m[2]}` : '';
}
