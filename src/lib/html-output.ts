/**
 * Extract the first fenced HTML document from an AI response.
 * Returns null when the response does not contain an explicit HTML code fence.
 * The returned HTML is untrusted; callers must render it in a restricted sandbox.
 */
export function extractFencedHtml(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/```html\s*([\s\S]*?)```/i);
  return match ? match[1] : null;
}
