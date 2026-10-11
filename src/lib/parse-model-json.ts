/**
 * Parse a model response that is expected to contain JSON.
 * Accepts plain JSON or one complete Markdown JSON fence; never evaluates code.
 */
export function parseModelJson(value: string): unknown | null {
  let candidate = value.trim();
  const fenced = candidate.match(/^\x60\x60\x60(?:json)?\s*\n([\s\S]*?)\n\x60\x60\x60$/i);
  if (fenced) candidate = fenced[1].trim();
  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    return null;
  }
}
