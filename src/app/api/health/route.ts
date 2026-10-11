import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const provider = (process.env.AI_PROVIDER || 'openai').trim().toLowerCase();
  const configuredProviders = {
    openai: Boolean(process.env.OPENAI_API_KEY?.trim()),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    google: Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()),
  };
  const supported = provider === 'auto' || Object.hasOwn(configuredProviders, provider);
  const configured = provider === 'auto'
    ? Object.values(configuredProviders).some(Boolean)
    : supported
      ? configuredProviders[provider as keyof typeof configuredProviders]
      : false;

  return NextResponse.json(
    {
      // Liveness means the process can answer requests; readiness requires at least
      // one configured provider in auto mode or the selected provider's own key.
      status: 'ok',
      ready: supported && configured,
      service: 'ai-builder',
      provider: supported ? provider : 'unsupported',
      providerConfigured: configured,
      configuredProviderCount: Object.values(configuredProviders).filter(Boolean).length,
      timestamp: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
