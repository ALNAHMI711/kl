import { describe, expect, it } from 'vitest';
import { readTextBodyLimited } from './read-limited-body';

describe('readTextBodyLimited', () => {
  it('reads a body within the byte limit', async () => {
    const request = new Request('http://localhost', { method: 'POST', body: '{"prompt":"hello"}' });
    await expect(readTextBodyLimited(request, 32)).resolves.toBe('{"prompt":"hello"}');
  });

  it('rejects a body exceeding the byte limit', async () => {
    const request = new Request('http://localhost', { method: 'POST', body: 'x'.repeat(33) });
    await expect(readTextBodyLimited(request, 32)).resolves.toBeNull();
  });

  it('enforces byte limits for multibyte UTF-8 text', async () => {
    const request = new Request('http://localhost', { method: 'POST', body: 'ع'.repeat(4) });
    await expect(readTextBodyLimited(request, 8)).resolves.toBe('ع'.repeat(4));
    const oversized = new Request('http://localhost', { method: 'POST', body: 'ع'.repeat(5) });
    await expect(readTextBodyLimited(oversized, 8)).resolves.toBeNull();
  });
});
