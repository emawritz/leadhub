import type { ProgressEvent } from '@leadhub/core';

export function parseProgressLine(line: string): ProgressEvent | null {
  const t = line.trim();
  if (!t.startsWith('{')) return null;
  try {
    const obj = JSON.parse(t) as Partial<ProgressEvent>;
    return typeof obj.phase === 'string' ? (obj as ProgressEvent) : null;
  } catch {
    return null;
  }
}
