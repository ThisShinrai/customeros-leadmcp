import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const nextConfig: NextConfig = {
  serverExternalPackages: ['wrangler'],
  images: {
    remotePatterns: [
      { hostname: '*.r2.cloudflarestorage.com' },
      { hostname: '*.r2.dev' },
    ],
  },
};

// Makes getCloudflareContext() work in `next dev` (D1 / R2 / env bindings
// via miniflare, reading wrangler.toml + .dev.vars).
initOpenNextCloudflareForDev();

export default nextConfig;
