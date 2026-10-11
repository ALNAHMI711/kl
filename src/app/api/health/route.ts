import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase();
  const supported = ['openai', 'anthropic', 'google'].includes(provider);
  const configured = provider === 'openai'
    ? Boolean(process.env.OPENAI_API_KEY)
    : provider === 'anthropic'
      ? Boolean(process.env.ANTHROPIC_API_KEY)
      : provider === 'google'
        ? Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY)
        : false;

  return NextResponse.json(
    {
      // Liveness means the process can answer requests; readiness also requires a
      // supported provider and its server-side API key.
      status: 'ok',
      ready: supported && configured,
      service: 'ai-builder',
      provider: supported ? provider : 'unsupported',
      providerConfigured: configured,
      timestamp: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
