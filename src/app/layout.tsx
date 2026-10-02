import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PwaRegister } from '@/components/pwa-register';

// viewport-fit=cover makes env(safe-area-inset-*) report real insets, so the
// floating bottom nav / chat button / toasts clear the mobile browser bar &
// home indicator instead of hiding behind them.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0A0A0A',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://c.epssys.de'),
  title: {
    default: 'epssys – White-Label Client-Portal für Agenturen',
    template: '%s · epssys',
  },
  description: 'Projekte, Dateien, Rechnungen, Live-Chat und ein gemeinsames Whiteboard – in einem White-Label-Portal in Ihrer Marke. In unter zwei Minuten startklar.',
  applicationName: 'epssys',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'epssys' },
  openGraph: {
    title: 'epssys – White-Label Client-Portal für Agenturen',
    description: 'Geben Sie Ihren Kunden ein Zuhause. Projekte, Dateien, Rechnungen, Chat & Whiteboard – in Ihrer Marke.',
    url: 'https://c.epssys.de',
    siteName: 'epssys',
    locale: 'de_DE',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'epssys – Client-Portal für Agenturen' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}<PwaRegister /></body>
    </html>
  );
}
