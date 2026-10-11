import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { NextResponse } from 'next/server';
import { readTextBodyLimited } from '@/lib/read-limited-body';
import { validateProjectFiles } from '@/lib/project-validation';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_PROMPT_LENGTH = 12000;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
const requestWindows = new Map<string, { count: number; startedAt: number }>();
const MAX_TRACKED_CLIENTS = 5000;
// Process-local only; use a shared limiter before deploying multiple instances.

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
    if (contentType !== 'application/json') {
      return NextResponse.json({ error: 'يجب إرسال الطلب بصيغة JSON.' }, { status: 415 });
    }

    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 20000) return NextResponse.json({ error: 'حجم الطلب أكبر من الحد المسموح.' }, { status: 413 });

    const origin = request.headers.get('origin');
    const host = request.headers.get('host') || new URL(request.url).host;
    if (origin && host) {
      try {
        if (new URL(origin).host !== host) return NextResponse.json({ error: 'مصدر الطلب غير مسموح.' }, { status: 403 });
      } catch {
        return NextResponse.json({ error: 'رأس Origin غير صالح.' }, { status: 403 });
      }
    }

    // Trust forwarding headers only when a reverse proxy is configured to overwrite them.
    const ip = process.env.TRUST_PROXY_HEADERS === 'true'
      ? request.headers.get('x-real-ip')?.trim() || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
      : 'untrusted-client';
    const now = Date.now();
    let window = requestWindows.get(ip);
    if (window && now - window.startedAt < WINDOW_MS && window.count >= MAX_REQUESTS_PER_WINDOW) {
      return NextResponse.json({ error: 'تم تجاوز حد إنشاء المشاريع مؤقتًا. انتظر قليلًا ثم حاول مجددًا.' }, { status: 429 });
    }

    // Remove expired entries before accepting a new client key so the map stays bounded.
    if (!window && requestWindows.size >= MAX_TRACKED_CLIENTS) {
      for (const [key, entry] of requestWindows) {
        if (now - entry.startedAt >= WINDOW_MS) requestWindows.delete(key);
        if (requestWindows.size < MAX_TRACKED_CLIENTS) break;
      }
      if (requestWindows.size >= MAX_TRACKED_CLIENTS) {
        return NextResponse.json({ error: 'الخدمة مشغولة مؤقتًا. حاول لاحقًا.' }, { status: 503 });
      }
    }

    if (!window || now - window.startedAt >= WINDOW_MS) {
      window = { count: 1, startedAt: now };
      requestWindows.set(ip, window);
    } else {
      window.count += 1;
    }

    const rawBody = await readTextBodyLimited(request, 20000);
    if (rawBody === null) {
      return NextResponse.json({ error: 'حجم الطلب أكبر من الحد المسموح.' }, { status: 413 });
    }
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'صيغة JSON غير صالحة.' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || !('prompt' in body) || typeof body.prompt !== 'string') {
      return NextResponse.json({ error: 'الطلب غير صالح.' }, { status: 400 });
    }
    const prompt = body.prompt.trim();
    if (prompt.length < 10) return NextResponse.json({ error: 'اكتب وصفًا واضحًا (10 أحرف على الأقل).' }, { status: 400 });
    if (prompt.length > MAX_PROMPT_LENGTH) return NextResponse.json({ error: 'الحد الأقصى للوصف 12000 حرف.' }, { status: 413 });

    const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase();
    let model;
    if (provider === 'openai') {
      if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'أضف OPENAI_API_KEY في إعدادات البيئة على الخادم.' }, { status: 503 });
      model = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(process.env.OPENAI_MODEL || 'gpt-4.1-mini');
    } else if (provider === 'anthropic') {
      if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'أضف ANTHROPIC_API_KEY في إعدادات البيئة على الخادم.' }, { status: 503 });
      model = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5');
    } else if (provider === 'google') {
      if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) return NextResponse.json({ error: 'أضف GOOGLE_GENERATIVE_AI_API_KEY في إعدادات البيئة على الخادم.' }, { status: 503 });
      model = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })(process.env.GOOGLE_GENERATIVE_AI_MODEL || 'gemini-2.5-flash');
    } else {
      return NextResponse.json({ error: 'استخدم مزودًا من: openai أو anthropic أو google.' }, { status: 400 });
    }

    const result = await generateText({
      model,
      system: 'أنت مهندس برمجيات خبير. أخرج JSON صالحًا فقط بالشكل {"name":"اسم المشروع","summary":"ملخص عربي","files":[{"path":"package.json","content":"..."},{"path":"index.html","content":"..."}]}. أنشئ مشروع واجهة أمامية أوليًا متعدد الملفات باستخدام Vite وReact وTypeScript. يجب أن يتضمن package.json وindex.html وsrc/main.tsx وsrc/App.tsx وsrc/styles.css. اجعل التصميم متجاوبًا ودعم RTL عند ملاءمة الوصف. لا تضف أسرارًا أو مفاتيح API. لا تنشئ backend مزيفًا أو تدّعِ النشر. لا تضع ملفات خارج مسارات src/ أو ملفات الجذر المسموح بها. في package.json استخدم فقط أوامر scripts المعروفة: dev=vite، build=vite build أو tsc -b && vite build، preview=vite preview، typecheck=tsc --noEmit، lint=eslint .، test=vitest run؛ لا تضف أوامر shell أو سكربتات مخصصة. استخدم تبعيات من سجل npm العادي فقط. لا تستخدم Markdown أو أسوار كود خارج JSON.',
      prompt: 'أنشئ الملفات اللازمة لمشروع أولي قابل للتطوير وفق الفكرة التالية. اجعل كل قيمة content نص الملف كاملًا.\n\n' + prompt,
      maxOutputTokens: 10000,
      temperature: 0.2,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(result.text);
    } catch {
      return NextResponse.json({ error: 'أعاد مزود الذكاء الاصطناعي تنسيقًا غير صالح. حاول مرة أخرى أو قلّل وصف المشروع.' }, { status: 502 });
    }
    if (!parsed || typeof parsed !== 'object' || !('files' in parsed) || !('name' in parsed) || !('summary' in parsed)) {
      return NextResponse.json({ error: 'استجابة المشروع ناقصة. حاول مرة أخرى.' }, { status: 502 });
    }
    const files = validateProjectFiles(parsed.files);
    if (!files) return NextResponse.json({ error: 'الملفات المولدة لم تجتز فحوص المسارات والحجم. أعد المحاولة بوصف أبسط.' }, { status: 502 });

    const name = typeof parsed.name === 'string' ? parsed.name.slice(0, 100) : 'مشروع جديد';
    const summary = typeof parsed.summary === 'string' ? parsed.summary.slice(0, 2000) : '';
    return NextResponse.json({ name, summary, files, provider });
  } catch (error) {
    console.error('AI project generation failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'تعذر إنشاء المشروع. تحقق من إعدادات المزود وحدود الاستخدام ثم أعد المحاولة.' }, { status: 502 });
  }
}
