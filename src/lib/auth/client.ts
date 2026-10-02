import { createAuthClient } from 'better-auth/react';
import { magicLinkClient } from 'better-auth/client/plugins';

// Always talk to the origin the app is actually served from. NEXT_PUBLIC_* is
// inlined at build time, so a hardcoded URL breaks whenever the build host (e.g.
// a Docker container) lacks the var — better-auth would then fall back to
// localhost:3000 in production. window.location.origin is correct on localhost,
// c.epssys.de, and *.workers.dev alike; the env var is only a server-side fallback.
const authBaseURL =
  typeof window !== 'undefined'
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_APP_URL || undefined);

export const authClient = createAuthClient({
  baseURL: authBaseURL,
  plugins: [magicLinkClient()],
});

export const { signIn, signOut, signUp, useSession } = authClient;
