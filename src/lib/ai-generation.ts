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
  const selected = (process.env.AI_PROVIDER || 'openai').trim().toLowerCase();
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

/**
 * In auto mode, try configured providers in AI_PROVIDER_ORDER. This is provider
 * failover, not a way to multiply a provider's quota. Explicit provider mode
 * never silently switches vendors, which keeps cost and data routing predictable.
 */
export async function generateWithConfiguredProvider(options: GenerationOptions): Promise<{ text: string; provider: ProviderName }> {
  const selected = (process.env.AI_PROVIDER || 'openai').trim().toLowerCase();
  const providers = configuredProviders();
  const failures: string[] = [];
  let attempted = 0;

  for (const provider of providers) {
    const model = getModel(provider);
    if (!model) continue;
    attempted += 1;
    try {
      const result = await generateText({
        ...options,
        abortSignal: AbortSignal.timeout(55_000),
        model,
      });
      return { text: result.text, provider };
    } catch (error) {
      // Keep secrets and provider response bodies out of logs and client responses.
      failures.push(provider);
      console.error('AI provider attempt failed:', provider, error instanceof Error ? error.name : 'UnknownError');
      if (selected !== 'auto') throw error;
    }
  }

  if (attempted === 0) throw new Error('No configured AI provider keys');
  throw new Error('All configured AI providers failed: ' + failures.join(','));
}
