'use server';

import { z } from 'zod';
import { requireAgencySession } from '@/lib/auth/session';
import { sendEmail } from '@/lib/email/send';
import { getRequestDb } from '@/lib/db';
import { ensureSupportCredentials } from '@/lib/support/credentials';
import { DEPARTMENT_IDS, DEPARTMENT_LABELS } from './departments';

const SUPPORT_INBOX = 'contact@epssys.de';

const SupportRequestSchema = z.object({
  department: z.enum(DEPARTMENT_IDS),
  subject: z.string().trim().min(2).max(200),
  message: z.string().trim().min(5).max(5000),
});

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

/**
 * Send a support request from an agency user to the epssys support inbox.
 * Auto-attaches identifying context (customer number, plan, sender) so support
 * can act without the user repeating it. Reply-To is the sender's email.
 */
export async function sendSupportRequest(input: unknown): Promise<{ ok: boolean }> {
  const session = await requireAgencySession();
  const data = SupportRequestSchema.parse(input);

  const db = await getRequestDb();
  const { customerNumber } = await ensureSupportCredentials(db, session.agency);
  const deptLabel = DEPARTMENT_LABELS[data.department];

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;font-size:14px;color:#111;line-height:1.5">
      <h2 style="margin:0 0 14px;font-size:18px">Support-Anfrage · ${deptLabel}</h2>
      <p style="margin:0 0 4px"><strong>Betreff:</strong> ${esc(data.subject)}</p>
      <div style="white-space:pre-wrap;border-left:3px solid #e4e3df;padding:10px 14px;margin:14px 0;background:#fafaf9;border-radius:6px">${esc(data.message)}</div>
      <hr style="border:none;border-top:1px solid #e4e3df;margin:20px 0"/>
      <table style="font-size:13px;color:#555;border-collapse:collapse">
        <tr><td style="padding:2px 0"><strong>Agentur</strong></td><td style="padding:2px 0 2px 16px">${esc(session.agency.name)}</td></tr>
        <tr><td style="padding:2px 0"><strong>Kundennr.</strong></td><td style="padding:2px 0 2px 16px;font-family:monospace">${customerNumber}</td></tr>
        <tr><td style="padding:2px 0"><strong>Plan</strong></td><td style="padding:2px 0 2px 16px">${esc(session.agency.plan)}</td></tr>
        <tr><td style="padding:2px 0"><strong>Abteilung</strong></td><td style="padding:2px 0 2px 16px">${deptLabel}</td></tr>
        <tr><td style="padding:2px 0"><strong>Absender</strong></td><td style="padding:2px 0 2px 16px">${esc(session.user.name)} &lt;${esc(session.user.email)}&gt;</td></tr>
      </table>
    </div>`;

  const res = await sendEmail({
    to: SUPPORT_INBOX,
    subject: `[${deptLabel}] ${data.subject} · ${customerNumber}`,
    html,
    replyTo: session.user.email,
  });

  return { ok: res.ok };
}
