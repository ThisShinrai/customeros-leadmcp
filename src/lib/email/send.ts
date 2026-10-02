/**
 * Core email sender. Graceful by design:
 *  - Always logs to console in development (so flows are testable without a
 *    verified sending domain).
 *  - Sends via Resend when a real API key is configured.
 *  - Never throws on delivery failure — auth/invite flows must not break just
 *    because email delivery is unavailable.
 */

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  /** Defaults to the epssys system sender. White-label senders pass their own. */
  from?: string;
  replyTo?: string;
}

const DEFAULT_FROM = 'epssys <noreply@customeros.epssys.de>';

export async function sendEmail({ to, subject, html, from, replyTo }: SendEmailInput): Promise<{ ok: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const isPlaceholder = !apiKey || apiKey.startsWith('re_placeholder') || apiKey.length < 10;

  if (process.env.NODE_ENV !== 'production') {
    console.log(`\n📧 [email] → ${to}  ·  "${subject}"${isPlaceholder ? '  (no RESEND key — console only)' : ''}`);
  }

  if (isPlaceholder) return { ok: false };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: from || DEFAULT_FROM,
        to,
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[email] Resend ${res.status}: ${body}`);
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.error('[email] send error:', e);
    return { ok: false };
  }
}
