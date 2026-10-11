'use client';

import { useEffect, useMemo, useState } from 'react';
import { strToU8, zipSync } from 'fflate';
import { validateProjectFiles } from '@/lib/project-validation';
import { extractFencedHtml } from '@/lib/html-output';

type ProjectFile = { path: string; content: string };
type ProjectResult = { name: string; summary: string; files: ProjectFile[]; provider: string };
type WorkspaceTab = 'preview' | 'code' | 'files';
type SavedWorkspace = { id: string; name: string; prompt: string; mode: 'project' | 'html'; result: string; project: ProjectResult | null; savedAt: string };

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
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [restored, setRestored] = useState(false);
  const [savedWorkspaces, setSavedWorkspaces] = useState<SavedWorkspace[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('ai-builder:last-workspace:v1');
      if (raw) {
        const saved: unknown = JSON.parse(raw);
        if (saved && typeof saved === 'object') {
          const item = saved as Record<string, unknown>;
          if (item.mode === 'html' || item.mode === 'project') setMode(item.mode);
          if (typeof item.prompt === 'string') setPrompt(item.prompt.slice(0, 12000));
          if (typeof item.result === 'string') setResult(item.result.slice(0, 150000));
          if (item.project && typeof item.project === 'object') {
            const p = item.project as Record<string, unknown>;
            const safeFiles = validateProjectFiles(p.files);
            if (typeof p.name === 'string' && typeof p.summary === 'string' && safeFiles) {
              setProject({
                name: p.name.slice(0, 100),
                summary: p.summary.slice(0, 2000),
                files: safeFiles,
                provider: typeof p.provider === 'string' ? p.provider.slice(0, 40) : 'restored',
              });
            }
          }
          if (typeof item.selectedFile === 'string') setSelectedFile(item.selectedFile);
          if (item.project && typeof item.project === 'object' || typeof item.result === 'string' && item.result.length > 0) {
            setTab('code');
            setRestored(true);
          }
        }
      }
    } catch {
      try { window.localStorage.removeItem('ai-builder:last-workspace:v1'); } catch { /* storage may be disabled */ }
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('ai-builder:saved-workspaces:v1');
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const safe = parsed.filter((item): item is SavedWorkspace => {
            if (!item || typeof item !== 'object') return false;
            const candidate = item as Partial<SavedWorkspace>;
            if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string' || typeof candidate.prompt !== 'string' || (candidate.mode !== 'project' && candidate.mode !== 'html') || typeof candidate.result !== 'string' || typeof candidate.savedAt !== 'string') return false;
            if (candidate.project === null) return true;
            if (!candidate.project || typeof candidate.project !== 'object') return false;
            const candidateProject = candidate.project as Partial<ProjectResult>;
            return typeof candidateProject.name === 'string' && typeof candidateProject.summary === 'string' && Boolean(validateProjectFiles(candidateProject.files));
          }).slice(0, 20);
          setSavedWorkspaces(safe);
        }
      }
    } catch {
      try { window.localStorage.removeItem('ai-builder:saved-workspaces:v1'); } catch { /* storage may be disabled */ }
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!project && !result) return;
    try {
      window.localStorage.setItem('ai-builder:last-workspace:v1', JSON.stringify({
        prompt, mode, result, project, selectedFile, savedAt: new Date().toISOString(),
      }));
    } catch {
      setError('تعذر حفظ مساحة العمل محليًا؛ قد تكون مساحة التخزين ممتلئة.');
    }
  }, [hydrated, prompt, mode, result, project, selectedFile]);

  function persistSavedWorkspaces(items: SavedWorkspace[]) {
    setSavedWorkspaces(items);
    try {
      window.localStorage.setItem('ai-builder:saved-workspaces:v1', JSON.stringify(items));
    } catch {
      setError('تعذر حفظ قائمة المشاريع؛ مساحة تخزين المتصفح قد تكون ممتلئة.');
    }
  }

  function saveCurrentWorkspace() {
    if (!project && !result) {
      setError('أنشئ مشروعًا أولًا قبل حفظه في القائمة.');
      return;
    }
    const name = (project?.name || prompt.trim().slice(0, 60) || 'نموذج HTML').slice(0, 100);
    const item: SavedWorkspace = {
      id: globalThis.crypto?.randomUUID?.() || `workspace-${Date.now()}`,
      name,
      prompt,
      mode,
      result,
      project,
      savedAt: new Date().toISOString(),
    };
    persistSavedWorkspaces([item, ...savedWorkspaces.filter((saved) => saved.name !== name)].slice(0, 20));
    setError('');
  }

  function openSavedWorkspace(item: SavedWorkspace) {
    const safeFiles = item.project ? validateProjectFiles(item.project.files) : null;
    setPrompt(item.prompt.slice(0, 12000));
    setMode(item.mode);
    setResult(item.result.slice(0, 150000));
    setProject(item.project && safeFiles ? { ...item.project, files: safeFiles } : null);
    setSelectedFile(item.project?.files[0]?.path || '');
    setTab('code');
    setRestored(true);
    setError('');
  }

  function deleteSavedWorkspace(id: string) {
    persistSavedWorkspaces(savedWorkspaces.filter((item) => item.id !== id));
  }

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

  async function copyActiveCode() {
    const code = activeFile?.content || result;
    if (!code) {
      setError('لا يوجد كود لنسخه حاليًا.');
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('تعذر النسخ تلقائيًا. حدّد الكود وانسخه يدويًا.');
    }
  }

  function downloadHtml() {
    const html = extractFencedHtml(result);
    if (html === null) {
      setError('لم أجد كتلة HTML في النتيجة. حاول مرة أخرى.');
      return;
    }
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
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

  const htmlPreview = useMemo(() => extractFencedHtml(result) || '', [result]);

  const hasOutput = Boolean(project || result);

  return (
    <main className="app-shell" dir="rtl">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="AI Builder الرئيسية">
          <span className="brand-mark">✳</span>
          <span className="brand-copy"><strong>صانع</strong><small>AI BUILDER</small></span>
        </a>
        <button className="new-project" type="button" onClick={() => { setPrompt(''); setProject(null); setResult(''); setError(''); setRestored(false); try { window.localStorage.removeItem('ai-builder:last-workspace:v1'); } catch { /* storage may be disabled */ } }}>
          <span>＋</span> مشروع جديد <kbd>⌘ K</kbd>
        </button>
        <div className="side-label">مساحة العمل</div>
        <button className="side-link selected" type="button"><span>⌂</span> نظرة عامة</button>
        <button className="side-link" type="button" onClick={() => setTab('files')}><span>▤</span> ملفات المشروع</button>
        <button className="side-link" type="button" onClick={() => setTab('code')}><span>{'</>'}</span> محرر الكود</button>
        <div className="side-label projects-label">مشاريعي المحفوظة <span>{savedWorkspaces.length}</span></div>
        <div className="saved-project-list">{savedWorkspaces.length === 0 ? <div className="empty-projects"><span className="empty-folder">▱</span><p>لا توجد مشاريع محفوظة</p><small>احفظ أي نتيجة من مساحة العمل</small></div> : savedWorkspaces.map((item) => <div className="saved-project-item" key={item.id}><button type="button" className="saved-project-open" onClick={() => openSavedWorkspace(item)} title={item.name}><span>▤</span><span>{item.name}</span></button><button type="button" className="saved-project-delete" onClick={() => deleteSavedWorkspace(item.id)} aria-label={`حذف ${item.name}`}>×</button></div>)}</div>
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
              <div className="workspace-heading"><div><div className="eyebrow">مساحة المشروع</div><h1>{project?.name || 'نموذج HTML'}</h1><p>{project?.summary || 'تم استلام نتيجة التوليد. راجع المخرجات قبل استخدامها.'}</p>{restored && <span className="saved-workspace-badge">✓ تمت استعادة آخر مساحة عمل من هذا المتصفح</span>}</div><div className="workspace-actions"><button className="secondary-button" onClick={saveCurrentWorkspace} type="button">حفظ في مشاريعي</button>{project && <button className="secondary-button" onClick={downloadProject} type="button">↓ تنزيل ZIP</button>}{result && <button className="secondary-button" onClick={downloadHtml} type="button">↓ تنزيل HTML</button>}<button className="primary-small" onClick={() => { setProject(null); setResult(''); setPrompt(''); setError(''); setRestored(false); try { window.localStorage.removeItem('ai-builder:last-workspace:v1'); } catch { /* storage may be disabled */ } }} type="button">＋ مشروع جديد</button></div></div>
              {error && <div className="notice error" role="alert">{error}</div>}
              <div className="workspace-frame">
                <div className="frame-toolbar"><div className="window-dots"><i /><i /><i /></div><div className="workspace-tabs"><button className={tab === 'preview' ? 'active' : ''} onClick={() => setTab('preview')} type="button">◉ المعاينة</button><button className={tab === 'code' ? 'active' : ''} onClick={() => setTab('code')} type="button">{'</>'} الكود</button><button className={tab === 'files' ? 'active' : ''} onClick={() => setTab('files')} type="button">▤ الملفات</button></div><span className="frame-status"><i /> ملفات مولدة</span></div>
                {tab === 'preview' && (result && htmlPreview ? <div className="html-preview-wrap"><div className="preview-safety-note">معاينة HTML ثابتة — تم تعطيل صلاحيات JavaScript داخل الإطار.</div><iframe className="html-preview-frame" title="معاينة HTML المولّد" sandbox="" referrerPolicy="no-referrer" srcDoc={htmlPreview} /></div> : <div className="preview-placeholder"><div className="preview-symbol">▧</div><h2>المعاينة التفاعلية للمشروع قيد التجهيز</h2><p>{project ? 'المشروع متعدد الملفات يحتاج بيئة بناء معزولة قبل عرضه. يمكنك مراجعة الملفات أو تنزيلها الآن.' : 'لم نعثر على كتلة HTML صالحة للمعاينة. افتح تبويب الكود لمراجعة النتيجة.'}</p><button className="secondary-button" onClick={() => setTab(project ? 'files' : 'code')} type="button">عرض {project ? 'الملفات' : 'الكود'} <span>←</span></button></div>)}
                {tab === 'code' && <div className="code-view"><div className="code-file-list">{(project?.files || []).map((file) => <button type="button" key={file.path} className={activeFile?.path === file.path ? 'file-item active' : 'file-item'} onClick={() => setSelectedFile(file.path)}><span>◇</span>{file.path}</button>)}</div><div className="code-editor"><div className="editor-title"><span>◇</span>{activeFile?.path || 'نتيجة التوليد'}<span className="read-only">قراءة فقط</span><button className="copy-code-button" type="button" onClick={copyActiveCode}>{copied ? 'تم النسخ ✓' : 'نسخ الكود'}</button></div><pre dir="ltr">{activeFile?.content || result || 'لا توجد ملفات لعرضها.'}</pre></div></div>}
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
