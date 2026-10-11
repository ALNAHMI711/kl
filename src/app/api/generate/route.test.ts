import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

afterEach(() => {
  vi.unstubAllEnvs();
});

function request(body: string, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  });
}

describe('POST /api/generate', () => {
  it('rejects malformed JSON without calling the AI provider', async () => {
    const response = await POST(request('{not-json'));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('JSON');
  });

  it('rejects prompts that are too short', async () => {
    const response = await POST(request(JSON.stringify({ prompt: 'short' })));
    expect(response.status).toBe(400);
  });

  it('returns a safe setup error when the selected provider has no API key', async () => {
    vi.stubEnv('AI_PROVIDER', 'openai');
    vi.stubEnv('OPENAI_API_KEY', '');
    const response = await POST(request(JSON.stringify({ prompt: 'Create a responsive Arabic landing page' })));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toContain('OPENAI_API_KEY');
    expect(JSON.stringify(body)).not.toContain('test-secret');
  });

  it('rejects a mismatched browser origin', async () => {
    const response = await POST(request(
      JSON.stringify({ prompt: 'Create a responsive Arabic landing page' }),
      { origin: 'https://attacker.example' },
    ));
    expect(response.status).toBe(403);
  });
});
