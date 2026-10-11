import { describe, expect, it } from 'vitest';
import { readTextBodyLimited } from './read-limited-body';

describe('readTextBodyLimited', () => {
  it('reads a body within the byte limit', async () => {
    const body = '{"prompt":"hello"}';
    const request = new Request('http://localhost', { method: 'POST', body });
    await expect(readTextBodyLimited(request, 32)).resolves.toBe(body);
  });

  it('accepts a body exactly at the byte limit', async () => {
    const body = 'hello';
    const request = new Request('http://localhost', { method: 'POST', body });
    await expect(readTextBodyLimited(request, new TextEncoder().encode(body).byteLength)).resolves.toBe(body);
  });

  it('rejects a body exceeding the byte limit', async () => {
    const request = new Request('http://localhost', { method: 'POST', body: 'x'.repeat(33) });
    await expect(readTextBodyLimited(request, 32)).resolves.toBeNull();
  });

  it('enforces byte limits for multibyte UTF-8 text', async () => {
    const body = 'ع'.repeat(4);
    const request = new Request('http://localhost', { method: 'POST', body });
    await expect(readTextBodyLimited(request, 8)).resolves.toBe(body);
    const oversized = new Request('http://localhost', { method: 'POST', body: 'ع'.repeat(5) });
    await expect(readTextBodyLimited(oversized, 8)).resolves.toBeNull();
  });

  it('returns an empty string when the request has no body', async () => {
    const request = new Request('http://localhost', { method: 'POST' });
    await expect(readTextBodyLimited(request, 10)).resolves.toBe('');
  });
});
