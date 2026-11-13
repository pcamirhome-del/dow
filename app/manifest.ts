import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'SaveBox — Local Video & Audio Downloader',
    short_name: 'SaveBox',
    description:
      'Download videos from 144p up to 4K or extract MP3 audio locally from YouTube, Facebook, Instagram, TikTok, and X.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#090D16',
    theme_color: '#090D16',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
