import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

type ProviderName = 'openai' | 'anthropic' | 'google';

type GenerationOptions = {
  system: string;
  prompt: string;
  maxOutputTokens: number;
  temperature: number;
};

function configuredProviders(): ProviderName[] {
  const selected = (process.env.AI_PROVIDER || 'auto').trim().toLowerCase();
  if (selected !== 'auto') {
    if (selected !== 'openai' && selected !== 'anthropic' && selected !== 'google') {
      throw new Error('Unsupported AI_PROVIDER');
    }
    return [selected];
  }

  const allowed: ProviderName[] = ['openai', 'anthropic', 'google'];
  const requested = (process.env.AI_PROVIDER_ORDER || 'google,openai,anthropic')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is ProviderName => allowed.includes(value as ProviderName));
  return [...new Set([...requested, ...allowed])];
}

function getModel(provider: ProviderName) {
  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return null;
    return createOpenAI({ apiKey })(process.env.OPENAI_MODEL?.trim() || 'gpt-4.1-mini');
  }
  if (provider === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) return null;
    return createAnthropic({ apiKey })(process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-4-5');
  }
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (!apiKey) return null;
  return createGoogleGenerativeAI({ apiKey })(process.env.GOOGLE_GENERATIVE_AI_MODEL?.trim() || 'gemini-2.5-flash');
}

function safeErrorDetails(error: unknown): { name: string; statusCode?: number; message?: string } {
  if (!(error instanceof Error)) return { name: 'UnknownError' };
  const providerError = error as Error & { statusCode?: unknown; status?: unknown };
  // Provider messages are useful for diagnosis, but never log credentials or query-string keys.
  const message = error.message
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[redacted]')
    .replace(/sk-[0-9A-Za-z_-]{10,}/g, '[redacted]')
    .replace(/(key|api_key|token)=([^&\\s]+)/gi, '$1=[redacted]')
    .slice(0, 180);
  const rawStatus = providerError.statusCode ?? providerError.status;
  const statusCode = typeof rawStatus === 'number' ? rawStatus : undefined;
  return { name: error.name, ...(statusCode ? { statusCode } : {}), message };
}

/**
 * In auto mode, try configured providers in AI_PROVIDER_ORDER. This is provider
 * failover, not a way to multiply a provider's quota. Explicit provider mode
 * never silently switches vendors, which keeps cost and data routing predictable.
 */
export async function generateWithConfiguredProvider(options: GenerationOptions): Promise<{ text: string; provider: ProviderName }> {
  const selected = (process.env.AI_PROVIDER || 'auto').trim().toLowerCase();
  const providers = configuredProviders();
  const available = providers
    .map((provider) => ({ provider, model: getModel(provider) }))
    .filter((item): item is { provider: ProviderName; model: NonNullable<ReturnType<typeof getModel>> } => item.model !== null);
  if (available.length === 0) throw new Error('No configured AI provider keys');

  // Share the route's ~55-second budget among only providers that actually have keys.
  // Two configured providers receive up to 25s each; three receive ~18s each.
  const perProviderTimeout = selected === 'auto'
    ? Math.min(25_000, Math.floor(52_000 / available.length))
    : 55_000;
  const failures: string[] = [];

  for (const { provider, model } of available) {
    try {
      const result = await generateText({
        ...options,
        abortSignal: AbortSignal.timeout(perProviderTimeout),
        model,
      });
      return { text: result.text, provider };
    } catch (error) {
      failures.push(provider);
      console.error('AI provider attempt failed:', provider, safeErrorDetails(error));
      if (selected !== 'auto') throw error;
    }
  }

  throw new Error('All configured AI providers failed: ' + failures.join(','));
}
