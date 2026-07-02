export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function resolveOutputPaths(
  output: string | undefined,
  query: string,
  date: string,
): { csv: string; json: string } {
  const base = output
    ? output.replace(/\.(csv|json)$/i, '')
    : `output/${slugify(query)}_${date}`;
  return { csv: `${base}.csv`, json: `${base}.json` };
}
