/**
 * Read a request body with a hard byte limit, including requests without
 * Content-Length. Cancels the stream as soon as the limit is exceeded.
 */
export async function readTextBodyLimited(request: Request, maxBytes: number): Promise<string | null> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel('Request body exceeds configured limit').catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
    const combined = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder().decode(combined);
  } finally {
    reader.releaseLock();
  }
}
