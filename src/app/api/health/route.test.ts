import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GET /api/health', () => {
  it('reports liveness and readiness without exposing secret values', async () => {
    vi.stubEnv('AI_PROVIDER', 'openai');
    vi.stubEnv('OPENAI_API_KEY', 'test-secret-key');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(body.status).toBe('ok');
    expect(body.ready).toBe(true);
    expect(body.provider).toBe('openai');
    expect(body.providerConfigured).toBe(true);
    expect(JSON.stringify(body)).not.toContain('test-secret-key');
  });

  it('reports missing provider configuration without failing liveness', async () => {
    vi.stubEnv('AI_PROVIDER', 'google');
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', '');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.ready).toBe(false);
    expect(body.provider).toBe('google');
    expect(body.providerConfigured).toBe(false);
  });

  it('treats whitespace-only API keys as missing', async () => {
    vi.stubEnv('AI_PROVIDER', 'openai');
    vi.stubEnv('OPENAI_API_KEY', '   ');
    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe('ok');
    expect(body.ready).toBe(false);
    expect(body.providerConfigured).toBe(false);
  });

  it('marks an unsupported provider as not ready without disclosing configuration', async () => {
    vi.stubEnv('AI_PROVIDER', 'unknown-provider');
    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe('ok');
    expect(body.ready).toBe(false);
    expect(body.provider).toBe('unsupported');
    expect(body.providerConfigured).toBe(false);
  });
});
