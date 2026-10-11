import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  applicationName: 'AI Builder',
  title: {
    default: 'AI Builder | منشئ التطبيقات الذكي',
    template: '%s | AI Builder',
  },
  description: 'أنشئ واجهات ومشاريع ويب متعددة الملفات بمساعدة الذكاء الاصطناعي، ثم راجع الملفات ونزّل مشروعك.',
  keywords: ['AI Builder', 'منشئ التطبيقات', 'إنشاء مواقع', 'React', 'Vite', 'الذكاء الاصطناعي'],
  openGraph: {
    title: 'AI Builder | منشئ التطبيقات الذكي',
    description: 'حوّل فكرتك إلى نموذج ويب أو مشروع أولي متعدد الملفات.',
    type: 'website',
    locale: 'ar',
    siteName: 'AI Builder',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
