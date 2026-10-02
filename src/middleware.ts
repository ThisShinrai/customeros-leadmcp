import { NextResponse, type NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Custom-domain routing. When a request arrives on a tenant's own domain
 * (e.g. portal.agentur.de) instead of our primary host, we look up the agency
 * by `agencies.custom_domain` and transparently rewrite the request to that
 * agency's portal (`/app/p/<slug>/...`) — the visitor keeps seeing their domain.
 *
 * On the primary host this is a cheap string check that returns immediately.
 * Everything is wrapped defensively: any failure falls through to the normal
 * response, so the app can never be taken down by this middleware.
 *
 * NOTE: the tenant domain must first be attached to this Worker on the
 * Cloudflare side (Custom Hostname / Cloudflare for SaaS) so traffic + TLS
 * actually reach us — that is a one-time infra step per domain.
 */

// Hosts that are always "us" — never treated as a tenant custom domain.
const PRIMARY_HOSTS = new Set(['c.epssys.de']);
const SKIP_SUFFIXES = ['.workers.dev', '.epssys.de', '.pages.dev'];

function isPrimaryHost(host: string): boolean {
  if (!host) return true;
  if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('localhost:') || host.startsWith('127.0.0.1:')) return true;
  if (PRIMARY_HOSTS.has(host)) return true;
  return SKIP_SUFFIXES.some((s) => host.endsWith(s));
}

export async function middleware(req: NextRequest) {
  const host = (req.headers.get('host') || '').toLowerCase().split(':')[0];
  if (isPrimaryHost(host)) return NextResponse.next();

  const { pathname } = req.nextUrl;
  // Don't touch app/api/asset routes — only the public-facing portal entry.
  if (
    pathname.startsWith('/app/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  try {
    const { env } = await getCloudflareContext({ async: true });
    const row = await env.DB
      .prepare('SELECT slug FROM agencies WHERE custom_domain = ?1 LIMIT 1')
      .bind(host)
      .first<{ slug: string }>();
    if (!row?.slug) return NextResponse.next();

    const url = req.nextUrl.clone();
    url.pathname = `/app/p/${row.slug}${pathname === '/' ? '' : pathname}`;
    const res = NextResponse.rewrite(url);
    res.headers.set('x-epssys-portal', row.slug);
    return res;
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  // Run on page-like requests; skip Next internals + obvious static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
