'use client';

import { useMemo, useState } from 'react';
import { strToU8, zipSync } from 'fflate';

type ProjectFile = { path: string; content: string };
type ProjectResult = { name: string; summary: string; files: ProjectFile[]; provider: string };
type WorkspaceTab = 'preview' | 'code' | 'files';

const examples = [
  { icon: '▦', title: 'متجر إلكتروني', description: 'منتجات وسلة شراء ولوحة تحكم', prompt: 'أنشئ متجرًا إلكترونيًا عربيًا متجاوبًا لعرض المنتجات مع بحث وتصنيفات وسلة شراء أمامية.' },
  { icon: '◫', title: 'لوحة تحكم', description: 'إحصاءات ورسوم وجداول', prompt: 'أنشئ لوحة تحكم عربية لإدارة المشاريع والمهام، تتضمن بطاقات إحصائية وجدول بيانات وفلاتر وتصميمًا احترافيًا.' },
  { icon: '✧', title: 'صفحة هبوط', description: 'تعريف بالمنتج وزر دعوة', prompt: 'أنشئ صفحة هبوط عربية عصرية لمنتج رقمي مع قسم رئيسي ومزايا وأسعار وأسئلة شائعة وزر دعوة لاتخاذ إجراء.' },
  { icon: '▤', title: 'تطبيق مهام', description: 'تنظيم العمل والإنجاز', prompt: 'أنشئ تطبيق مهام عربيًا بواجهة Kanban، مع إضافة المهام وتصنيفها حسب الحالة والأولوية.' },
];

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [project, setProject] = useState<ProjectResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'project' | 'html'>('project');
  const [tab, setTab] = useState<WorkspaceTab>('preview');
  const [selectedFile, setSelectedFile] = useState('');

  const activeFile = useMemo(() => {
    if (!project) return undefined;
    return project.files.find((file) => file.path === (selectedFile || project.files[0]?.path));
  }, [project, selectedFile]);

  async function build() {
    setError('');
    setResult('');
    setProject(null);
    if (prompt.trim().length < 10) {
      setError('اكتب وصفًا واضحًا للمشروع (10 أحرف على الأقل).');
      return;
    }
    setLoading(true);
    setTab('preview');
    try {
      const response = await fetch(mode === 'project' ? '/api/generate-project' : '/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'تعذر إنشاء المشروع.');
      if (mode === 'project') {
        const generated = data as ProjectResult;
        setProject(generated);
        setSelectedFile(generated.files[0]?.path || '');
      } else {
        setResult(data.text);
      }
      setTab('code');
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
    if (!match) {
      setError('لم أجد كتلة HTML في النتيجة. حاول مرة أخرى.');
      return;
    }
    const url = URL.createObjectURL(new Blob([match[1]], { type: 'text/html;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai-builder-prototype.html';
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadProject() {
    if (!project) return;
    const files: Record<string, Uint8Array> = {};
    for (const file of project.files) files[file.path] = strToU8(file.content);
    files['AI-BUILDER-README.txt'] = strToU8(
      'Generated project: ' + project.name + '\n' + project.summary + '\n\n' +
      'Review generated code before running. This project has not been security-audited or tested.'
    );
    const zipped = zipSync(files, { level: 6 });
    const url = URL.createObjectURL(new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai-builder-project.zip';
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const hasOutput = Boolean(project || result);

  return (
    <main className="app-shell" dir="rtl">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="AI Builder الرئيسية">
          <span className="brand-mark">✳</span>
          <span className="brand-copy"><strong>صانع</strong><small>AI BUILDER</small></span>
        </a>
        <button className="new-project" type="button" onClick={() => { setPrompt(''); setProject(null); setResult(''); setError(''); }}>
          <span>＋</span> مشروع جديد <kbd>⌘ K</kbd>
        </button>
        <div className="side-label">مساحة العمل</div>
        <button className="side-link selected" type="button"><span>⌂</span> نظرة عامة</button>
        <button className="side-link" type="button" onClick={() => setTab('files')}><span>▤</span> ملفات المشروع</button>
        <button className="side-link" type="button" onClick={() => setTab('code')}><span>{'</>'}</span> محرر الكود</button>
        <div className="side-label projects-label">مشاريعك <span>—</span></div>
        <div className="empty-projects"><span className="empty-folder">▱</span><p>مشاريعك الجديدة<br />ستظهر هنا</p><small>هذه القائمة للواجهة الحالية</small></div>
        <div className="sidebar-bottom">
          <div className="plan-card"><span className="plan-icon">✦</span><div><strong>مساحة البناء</strong><p>أنشئ فكرتك الأولى الآن</p></div></div>
          <div className="profile-row"><div className="avatar">م</div><div className="profile-copy"><strong>مساحة شخصية</strong><small>نسخة تجريبية</small></div><span className="dots">•••</span></div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>مساحة العمل</span><b>/</b><strong>{project?.name || 'مشروع جديد'}</strong></div>
          <div className="top-actions"><span className="connection"><i /> الواجهة متصلة</span><button className="icon-button" type="button" aria-label="الإعدادات">⚙</button><div className="avatar small-avatar">م</div></div>
        </header>

        <div className="content">
          {!hasOutput && !loading && (
            <section className="welcome">
              <div className="welcome-orbit"><span>✳</span><i /><b /></div>
              <div className="eyebrow"><span /> مساعد بناء المواقع بالذكاء الاصطناعي</div>
              <h1>كل فكرة تستحق أن <em>تُبنى.</em></h1>
              <p className="welcome-subtitle">صف ما تتخيله، ودعنا نبدأ بتحويله إلى مشروع ويب يمكنك تطويره.</p>
              <div className="prompt-panel">
                <label htmlFor="project-prompt">ما الذي تريد إنشاءه؟</label>
                <textarea id="project-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="مثال: أنشئ لوحة تحكم عربية لإدارة متجر إلكتروني..." rows={4} maxLength={12000} />
                <div className="prompt-toolbar">
                  <div className="prompt-tools"><span className="sparkle">✦</span><span>وصف فكرتك بالتفصيل</span><span className="char-count">{prompt.length.toLocaleString('ar')}/١٢٬٠٠٠</span></div>
                  <button className="build-button" onClick={build} type="button"><span>✦</span> ابدأ البناء <b>←</b></button>
                </div>
                <div className="generation-options">
                  <span>نوع المخرجات</span>
                  <button type="button" className={mode === 'project' ? 'option-pill active' : 'option-pill'} onClick={() => setMode('project')}><span>▦</span> مشروع متعدد الملفات</button>
                  <button type="button" className={mode === 'html' ? 'option-pill active' : 'option-pill'} onClick={() => setMode('html')}><span>{'</>'}</span> نموذج HTML</button>
                </div>
              </div>
              {error && <div className="notice error" role="alert">{error}</div>}
              <div className="ideas-heading"><div><strong>ابدأ من فكرة جاهزة</strong><span>اختر قالبًا لتعبئة وصفك</span></div><span className="ideas-spark">✧</span></div>
              <div className="idea-grid">{examples.map((example) => (
                <button className="idea-card" type="button" key={example.title} onClick={() => setPrompt(example.prompt)}>
                  <span className="idea-icon">{example.icon}</span><span className="idea-title">{example.title}</span><span className="idea-description">{example.description}</span><span className="idea-arrow">↗</span>
                </button>
              ))}</div>
              <div className="bottom-note"><span>ⓘ</span> يتم إنشاء ملفات أولية؛ راجعها واختبرها قبل استخدامها أو نشرها.</div>
            </section>
          )}

          {loading && <section className="loading-panel" role="status"><div className="loader-orbit">✳</div><h2>نحوّل فكرتك إلى مشروع…</h2><p>يتم توليد المحتوى والتحقق من الملفات. قد يستغرق ذلك بعض الوقت.</p><div className="loading-bar"><span /></div><small>لا تغلق الصفحة أثناء الإنشاء</small></section>}

          {hasOutput && !loading && (
            <section className="workspace">
              <div className="workspace-heading"><div><div className="eyebrow">مساحة المشروع</div><h1>{project?.name || 'نموذج HTML'}</h1><p>{project?.summary || 'تم استلام نتيجة التوليد. راجع المخرجات قبل استخدامها.'}</p></div><div className="workspace-actions">{project && <button className="secondary-button" onClick={downloadProject} type="button">↓ تنزيل ZIP</button>}{result && <button className="secondary-button" onClick={downloadHtml} type="button">↓ تنزيل HTML</button>}<button className="primary-small" onClick={() => { setProject(null); setResult(''); setPrompt(''); setError(''); }} type="button">＋ مشروع جديد</button></div></div>
              {error && <div className="notice error" role="alert">{error}</div>}
              <div className="workspace-frame">
                <div className="frame-toolbar"><div className="window-dots"><i /><i /><i /></div><div className="workspace-tabs"><button className={tab === 'preview' ? 'active' : ''} onClick={() => setTab('preview')} type="button">◉ المعاينة</button><button className={tab === 'code' ? 'active' : ''} onClick={() => setTab('code')} type="button">{'</>'} الكود</button><button className={tab === 'files' ? 'active' : ''} onClick={() => setTab('files')} type="button">▤ الملفات</button></div><span className="frame-status"><i /> ملفات مولدة</span></div>
                {tab === 'preview' && <div className="preview-placeholder"><div className="preview-symbol">▧</div><h2>المعاينة الآمنة قيد التجهيز</h2><p>لم يتم تشغيل الكود المولد داخل المتصفح. افتح تبويب الكود لمراجعته أو نزّل الملفات.</p><button className="secondary-button" onClick={() => setTab('code')} type="button">عرض الكود <span>←</span></button></div>}
                {tab === 'code' && <div className="code-view"><div className="code-file-list">{(project?.files || []).map((file) => <button type="button" key={file.path} className={activeFile?.path === file.path ? 'file-item active' : 'file-item'} onClick={() => setSelectedFile(file.path)}><span>◇</span>{file.path}</button>)}</div><div className="code-editor"><div className="editor-title"><span>◇</span>{activeFile?.path || 'نتيجة التوليد'}<span className="read-only">قراءة فقط</span></div><pre dir="ltr">{activeFile?.content || result || 'لا توجد ملفات لعرضها.'}</pre></div></div>}
                {tab === 'files' && <div className="files-view">{project?.files.map((file) => <button type="button" key={file.path} className="file-row" onClick={() => { setSelectedFile(file.path); setTab('code'); }}><span className="file-type">◇</span><span><strong>{file.path}</strong><small>{file.content.length.toLocaleString('en-US')} حرف</small></span><b>فتح ←</b></button>) || <p className="empty-result">هذه النتيجة نص HTML وليست مشروع ملفات متعددًا. يمكنك تنزيلها من الأعلى.</p>}</div>}
              </div>
              <div className="workspace-footnote"><span>ⓘ</span> المخرجات لم تجتز بعد بناءً فعليًا أو مراجعة أمنية كاملة. لا تشغّل ملفات غير موثوقة.</div>
            </section>
          )}
        </div>
        <footer className="app-footer"><span>صانع <b>AI BUILDER</b></span><span>مصمم لبناء أفكارك، خطوة بخطوة <i>✳</i></span></footer>
      </section>
    </main>
  );
}
