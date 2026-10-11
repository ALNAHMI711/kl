'use client';

import { useState } from 'react';

const examples = ['أنشئ متجرًا إلكترونيًا عربيًا', 'أنشئ لوحة إدارة للمشاريع', 'أنشئ صفحة هبوط لمنتج جديد'];

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [notice, setNotice] = useState('');
  return <main className="shell">
    <header className="topbar"><div className="brand"><span className="logo">✦</span><div><strong>AI Builder</strong><small>من فكرتك إلى مشروع ويب</small></div></div><span className="badge">نسخة أولية</span></header>
    <section className="hero"><div className="eyebrow">✦ مساعدك لبناء التطبيقات</div><h1>ماذا تريد أن <span>تبني اليوم؟</span></h1><p>اكتب فكرتك، وحدد شكل الموقع أو التطبيق الذي تحتاجه. هذه الواجهة هي نقطة البداية للمنصة.</p>
      <div className="composer"><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="صف الموقع أو التطبيق الذي تريد إنشاءه بالتفصيل..." rows={4}/><div className="composer-foot"><span>كلما كان الوصف أوضح، كانت النتيجة أفضل</span><button onClick={()=>setNotice(prompt.trim() ? 'الواجهة جاهزة، لكن توليد الملفات غير مفعّل حتى الآن. الخطوة التالية هي توصيل واجهة API آمنة للمزود وإضافة معاينة معزولة.' : 'اكتب وصفًا لفكرتك أولًا.')}>✦ ابدأ البناء</button></div></div>
      {notice && <div className="notice" role="status">{notice}</div>}
      <div className="examples"><span>جرّب فكرة:</span>{examples.map(x=><button key={x} className="chip" onClick={()=>setPrompt(x)}>{x}</button>)}</div>
    </section>
    <section className="grid"><article className="card"><div className="card-icon">⌘</div><h2>إنشاء المواقع</h2><p>صفحات هبوط ومتاجر ومواقع متجاوبة.</p><span className="state">واجهة أولية</span></article><article className="card"><div className="card-icon">▧</div><h2>إنشاء التطبيقات</h2><p>ابدأ بتطبيق ويب ثم أضف البيانات والوظائف.</p><span className="state">قيد التطوير</span></article><article className="card"><div className="card-icon">◈</div><h2>مفاتيح الذكاء الاصطناعي</h2><p>إعداد مزود الذكاء الاصطناعي بأمان على الخادم.</p><span className="state">لم تُربط بعد</span></article></section>
    <footer>منصة قيد التطوير · لا تضع مفاتيح API في الواجهة أو داخل المستودع.</footer>
  </main>;
}
