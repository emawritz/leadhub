export async function safeExtract(
  resolver: (selector: string) => Promise<string | null>,
  selectors: string[],
  fallback = '',
): Promise<string> {
  for (const selector of selectors) {
    try {
      const value = await resolver(selector);
      if (value && value.trim()) return value.trim();
    } catch {
      // selector inválido o timeout — probar el siguiente
    }
  }
  return fallback;
}
