import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Builder | منشئ التطبيقات الذكي',
  description: 'أنشئ مواقع وتطبيقات الويب باستخدام الذكاء الاصطناعي.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
