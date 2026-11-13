import type { Metadata, Viewport } from 'next';
import { Cairo, JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-arabic',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8FAFC' },
    { media: '(prefers-color-scheme: dark)', color: '#090D16' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'SaveBox — Local Video & Audio Downloader PWA',
  description:
    'Download videos locally from 144p up to 4K or extract MP3 audio from YouTube, Facebook, Instagram, TikTok, and X.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SaveBox',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'SaveBox — Local Video & Audio Downloader PWA',
    description:
      'Download videos locally from 144p up to 4K or extract MP3 audio from YouTube, Facebook, Instagram, TikTok, and X.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SaveBox — Local Video & Audio Downloader PWA',
    description:
      'Download videos locally from 144p up to 4K or extract MP3 audio from YouTube, Facebook, Instagram, TikTok, and X.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`dark ${plusJakarta.variable} ${cairo.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body
        className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#090D16] dark:text-slate-100 antialiased selection:bg-sky-500/20"
        style={{
          fontFamily:
            'var(--font-arabic), var(--font-sans), system-ui, -apple-system, sans-serif',
        }}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
