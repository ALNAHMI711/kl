'use client';
import { useState } from 'react';

type ProjectFile = { path: string; content: string };
type ProjectResult = { name: string; summary: string; files: ProjectFile[]; provider: string };

const examples = ['أنشئ متجرًا إلكترونيًا عربيًا', 'أنشئ لوحة إدارة للمشاريع', 'أنشئ صفحة هبوط لمنتج جديد'];

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [project, setProject] = useState<ProjectResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'html' | 'project'>('project');

  async function build() {
    setError('');
    setResult('');
    setProject(null);
    if (prompt.trim().length < 10) { setError('اكتب وصفًا واضحًا (10 أحرف على الأقل).'); return; }
    setLoading(true);
    try {
      const endpoint = mode === 'project' ? '/api/generate-project' : '/api/generate';
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'تعذر الإنشاء');
      if (mode === 'project') setProject(data as ProjectResult);
      else setResult(data.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حدث خطأ غير متوقع.');
    } finally {
      setLoading(false);
    }
  }

  function downloadHtml() {
    const tick = String.fromCharCode(96);
    const re = new RegExp(tick + tick + tick + 'html\\s*([\\s\\S]*?)' + tick + tick + tick, 'i');
    const match = result.match(re);
    if (!match) { setError('لم أجد كتلة HTML في النتيجة. حاول مرة أخرى.'); return; }
    const url = URL.createObjectURL(new Blob([match[1]], { type: 'text/html;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'ai-builder-prototype.html'; a.click();
    URL.revokeObjectURL(url);
  }

  function downloadProject() {
    if (!project) return;
    const bundle = { format: 'ai-builder-project-v1', name: project.name, summary: project.summary, generatedAt: new Date().toISOString(), files: project.files };
    const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'ai-builder-project.json'; a.click();
    URL.revokeObjectURL(url);
  }

  return <main className="shell">
    <header className="topbar"><div className="brand"><span className="logo">✦</span><div><strong>AI Builder</strong><small>من فكرتك إلى نموذج ويب</small></div></div><span className="badge">نسخة تجريبية</span></header>
    <section className="hero"><div className="eyebrow">✦ مساعدك لبناء المواقع</div><h1>ماذا تريد أن <span>تبني اليوم؟</span></h1><p>أنشئ مشروعًا متعدد الملفات أو نموذج HTML أوليًا من وصفك.</p>
      <div className="mode-switch" role="group" aria-label="نوع المشروع">
        <button className={mode === 'project' ? 'chip active' : 'chip'} onClick={() => setMode('project')} type="button">مشروع متعدد الملفات</button>
        <button className={mode === 'html' ? 'chip active' : 'chip'} onClick={() => setMode('html')} type="button">نموذج HTML واحد</button>
      </div>
      <div className="composer"><textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="صف الموقع أو التطبيق الذي تريد إنشاءه..." rows={4} maxLength={12000}/><div className="composer-foot"><span>{prompt.length}/12000 حرف</span><button disabled={loading} onClick={build}>{loading ? 'جارٍ الإنشاء…' : '✦ ابدأ البناء'}</button></div></div>
      {error && <div className="notice error" role="alert">{error}</div>}
      {loading && <div className="notice" role="status">جارٍ إنشاء الملفات ومراجعة المسارات والأحجام…</div>}
      <div className="examples"><span>جرّب فكرة:</span>{examples.map(x => <button key={x} className="chip" onClick={() => setPrompt(x)}>{x}</button>)}</div>
    </section>
    {project && <section className="result"><div className="result-head"><div><h2>{project.name}</h2><p>{project.summary}</p><p>المزود: {project.provider} · عدد الملفات: {project.files.length}</p></div><button className="download" onClick={downloadProject}>تنزيل حزمة JSON</button></div>
      <div className="file-list">{project.files.map(file => <details key={file.path}><summary>{file.path}</summary><pre dir="ltr">{file.content}</pre></details>)}</div>
      <p className="notice">هذه حزمة ملفات JSON وليست ZIP قابلة للتشغيل مباشرة. راجع الملفات وثبّت التبعيات وشغّل الاختبارات قبل النشر؛ لا توجد معاينة معزولة أو نشر تلقائي حتى الآن.</p>
    </section>}
    {result && <section className="result"><div className="result-head"><div><h2>نتيجة الإنشاء</h2><p>راجع النموذج قبل استخدامه في الإنتاج.</p></div><button className="download" onClick={downloadHtml}>تنزيل HTML</button></div><pre dir="auto">{result}</pre></section>}
    <section className="grid"><article className="card"><div className="card-icon">⌘</div><h2>مشاريع متعددة الملفات</h2><p>توليد ملفات أولية مع فحص المسارات وحدود الحجم.</p><span className="state">تجريبي</span></article><article className="card"><div className="card-icon">▧</div><h2>التشغيل والمعاينة</h2><p>تشغيل الكود المولد في بيئة معزولة ونشره يحتاجان مراحل إضافية.</p><span className="state">قيد التطوير</span></article><article className="card"><div className="card-icon">◈</div><h2>مفاتيح الذكاء الاصطناعي</h2><p>تُقرأ المفاتيح من الخادم فقط ولا تظهر في المتصفح.</p><span className="state">إعداد خادمي</span></article></section>
    <footer>لا تضع مفاتيح API في الواجهة أو داخل المستودع. راجع الأكواد المولدة قبل النشر.</footer>
  </main>;
}
