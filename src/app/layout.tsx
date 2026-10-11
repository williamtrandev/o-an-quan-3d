import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

const font = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-be-vietnam',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Ô Ăn Quan 3D',
  description:
    'Trò chơi dân gian Việt Nam trên bàn gỗ 3D giữa sân đình: đấu với máy hoặc hai người một máy.',
};

export const viewport: Viewport = { themeColor: '#1a120c' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // Browser extensions may add classes to <html> before React loads.
    <html lang="vi" className={font.variable} suppressHydrationWarning>
      <body className="font-sans text-white antialiased">{children}</body>
    </html>
  );
}
