import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Marva POS',
  description: 'Magazin uchun Point of Sale tizimi',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Marva POS',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#2563eb" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        {/* Telegram WebApp SDK */}
        <script src="https://telegram.org/js/telegram-web-app.js" />
      </head>
      <body className="bg-gray-50 text-gray-900 min-h-screen tg-body" suppressHydrationWarning>
        <Providers>{children}</Providers>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
              // Telegram WebApp: expand to full screen
              if (window.Telegram && window.Telegram.WebApp) {
                var tg = window.Telegram.WebApp;
                tg.expand();
                tg.ready();
                if (tg.requestFullscreen) tg.requestFullscreen();
                document.body.classList.add('is-tg');
                document.documentElement.style.setProperty('--tg-viewport-height', tg.viewportHeight + 'px');
                document.documentElement.style.setProperty('--tg-viewport-stable-height', tg.viewportStableHeight + 'px');
                tg.onEvent('viewportChanged', function(e) {
                  document.documentElement.style.setProperty('--tg-viewport-height', tg.viewportHeight + 'px');
                  document.documentElement.style.setProperty('--tg-viewport-stable-height', tg.viewportStableHeight + 'px');
                });
              }
              // Auto-restore session: if refresh_token exists but cookie is gone, refresh it
              (function() {
                var rt = localStorage.getItem('refresh_token');
                if (rt && !document.cookie.includes('access_token=')) {
                  fetch('/api/auth/refresh', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken: rt })
                  }).then(function(r) { return r.ok ? r.json() : Promise.reject(); })
                    .then(function(d) {
                      var maxAge = 7*24*60*60;
                      localStorage.setItem('access_token', d.accessToken);
                      document.cookie = 'access_token=' + d.accessToken + '; path=/; max-age=' + maxAge + '; SameSite=Lax';
                      var u = localStorage.getItem('user');
                      if (u) { try { document.cookie = 'user_role=' + JSON.parse(u).role + '; path=/; max-age=' + maxAge + '; SameSite=Lax'; } catch(e){} }
                    })
                    .catch(function() {
                      localStorage.removeItem('access_token');
                      localStorage.removeItem('refresh_token');
                      localStorage.removeItem('user');
                    });
                }
              })();
              // Track visual viewport for keyboard avoidance
              if (window.visualViewport) {
                function updateVV() {
                  document.documentElement.style.setProperty('--vv-height', window.visualViewport.height + 'px');
                  document.documentElement.style.setProperty('--vv-offset', window.visualViewport.offsetTop + 'px');
                }
                updateVV();
                window.visualViewport.addEventListener('resize', updateVV);
                window.visualViewport.addEventListener('scroll', updateVV);
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
