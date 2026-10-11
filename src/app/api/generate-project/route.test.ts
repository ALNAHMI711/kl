import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

afterEach(() => {
  vi.unstubAllEnvs();
});

function request(body: string, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/generate-project', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  });
}

describe('POST /api/generate-project', () => {
  it('rejects malformed JSON', async () => {
    const response = await POST(request('{not-json'));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('JSON');
  });

  it('rejects a prompt that is too short', async () => {
    const response = await POST(request(JSON.stringify({ prompt: 'short' })));
    expect(response.status).toBe(400);
  });

  it('returns a safe setup error when the provider key is missing', async () => {
    vi.stubEnv('AI_PROVIDER', 'openai');
    vi.stubEnv('OPENAI_API_KEY', '');
    const response = await POST(request(JSON.stringify({ prompt: 'Create a responsive Arabic dashboard' })));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain('OPENAI_API_KEY');
  });

  it('rejects a mismatched browser origin', async () => {
    const response = await POST(request(
      JSON.stringify({ prompt: 'Create a responsive Arabic dashboard' }),
      { origin: 'https://attacker.example' },
    ));
    expect(response.status).toBe(403);
  });
  it('rejects requests that do not declare JSON content type', async () => {
    const response = await POST(request(
      JSON.stringify({ prompt: 'Create a responsive Arabic interface' }),
      { 'content-type': 'text/plain' },
    ));
    expect(response.status).toBe(415);
    expect((await response.json()).error).toContain('JSON');
  });

  it('rejects a JSON body without a string prompt', async () => {
    const response = await POST(request(JSON.stringify({ prompt: 42 })));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('غير صالح');
  });

  it('rejects a request whose declared content length exceeds the limit', async () => {
    const response = await POST(request(
      JSON.stringify({ prompt: 'Create a responsive Arabic dashboard' }),
      { 'content-length': '20001' },
    ));
    expect(response.status).toBe(413);
  });

});
