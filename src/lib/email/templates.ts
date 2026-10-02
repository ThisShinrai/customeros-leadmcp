/**
 * Branded transactional email templates (inline-styled HTML for max client
 * compatibility). All optionally white-labeled per agency (name + accent).
 */

interface Brand {
  agencyName?: string;
  accentColor?: string;
}

function layout(opts: { brand?: Brand; heading: string; body: string; cta?: { label: string; url: string }; footer?: string }): string {
  const accent = opts.brand?.accentColor || '#0A0A0A';
  const sender = opts.brand?.agencyName || 'epssys';
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F3F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F3F0;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.06);">
        <tr><td style="padding:36px 36px 0;">
          <div style="display:inline-block;width:40px;height:40px;border-radius:12px;background:${accent};color:#fff;text-align:center;line-height:40px;font-weight:800;font-size:18px;">${(sender[0] || 'C').toUpperCase()}</div>
          <div style="margin-top:10px;font-size:13px;font-weight:600;color:#909090;letter-spacing:-.2px;">${sender}</div>
        </td></tr>
        <tr><td style="padding:20px 36px 0;">
          <h1 style="margin:0 0 12px;font-size:23px;font-weight:800;color:#0A0A0A;letter-spacing:-.6px;">${opts.heading}</h1>
          <div style="font-size:15px;line-height:1.55;color:#505050;">${opts.body}</div>
        </td></tr>
        ${opts.cta ? `<tr><td style="padding:26px 36px 0;">
          <a href="${opts.cta.url}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 26px;border-radius:100px;">${opts.cta.label}</a>
          <div style="margin-top:16px;font-size:12px;color:#b0b0b0;word-break:break-all;">Oder kopieren Sie diesen Link:<br><span style="color:#909090;">${opts.cta.url}</span></div>
        </td></tr>` : ''}
        <tr><td style="padding:30px 36px 36px;">
          <div style="border-top:1px solid #E4E3DF;margin-bottom:16px;"></div>
          <div style="font-size:12px;line-height:1.5;color:#b0b0b0;">${opts.footer || 'Sie erhalten diese E-Mail, weil ein Konto mit Ihrer Adresse aktiv ist. Falls Sie das nicht waren, ignorieren Sie diese Nachricht.'}</div>
        </td></tr>
      </table>
      <div style="margin-top:18px;font-size:11px;color:#b8b6b0;">Powered by epssys</div>
    </td></tr>
  </table>
</body></html>`;
}

export function magicLinkEmail(url: string, brand?: Brand): { subject: string; html: string } {
  return {
    subject: `Ihr Anmeldelink${brand?.agencyName ? ` · ${brand.agencyName}` : ''}`,
    html: layout({
      brand,
      heading: 'Anmelden',
      body: 'Klicken Sie auf den Button, um sich sicher anzumelden. Der Link ist 5 Minuten gültig und kann nur einmal verwendet werden.',
      cta: { label: 'Jetzt anmelden', url },
    }),
  };
}

export function clientInviteEmail(opts: { url: string; agencyName: string; accentColor?: string; clientName?: string }): { subject: string; html: string } {
  const brand = { agencyName: opts.agencyName, accentColor: opts.accentColor };
  return {
    subject: `${opts.agencyName} hat Sie zum Kundenportal eingeladen`,
    html: layout({
      brand,
      heading: `Willkommen${opts.clientName ? `, ${opts.clientName}` : ''}`,
      body: `<strong>${opts.agencyName}</strong> hat ein persönliches Portal für Sie eingerichtet. Hier sehen Sie Ihre Projekte, Dateien und Rechnungen an einem Ort — und chatten direkt mit dem Team. Kein Passwort nötig.`,
      cta: { label: 'Portal öffnen', url: opts.url },
      footer: `Diese Einladung wurde von ${opts.agencyName} über epssys versendet.`,
    }),
  };
}

export function teamInviteEmail(opts: { url: string; agencyName: string; accentColor?: string; roleLabel: string }): { subject: string; html: string } {
  const brand = { agencyName: opts.agencyName, accentColor: opts.accentColor };
  return {
    subject: `Einladung ins Team von ${opts.agencyName}`,
    html: layout({
      brand,
      heading: 'Team-Einladung',
      body: `Sie wurden als <strong>${opts.roleLabel}</strong> in das epssys-Workspace von <strong>${opts.agencyName}</strong> eingeladen. Klicken Sie unten, um Ihren Zugang zu aktivieren.`,
      cta: { label: 'Einladung annehmen', url: opts.url },
    }),
  };
}

export function proposalEmail(opts: {
  url: string;
  agencyName: string;
  accentColor?: string;
  clientName?: string;
  title: string;
  number: string | null;
  totalFormatted: string;
  validUntilFormatted?: string | null;
}): { subject: string; html: string } {
  const brand = { agencyName: opts.agencyName, accentColor: opts.accentColor };
  const accent = opts.accentColor || '#0A0A0A';
  const detailRow = (k: string, v: string) =>
    `<tr><td style="padding:6px 0;font-size:13px;color:#909090;">${k}</td><td align="right" style="padding:6px 0;font-size:13px;font-weight:700;color:#0A0A0A;">${v}</td></tr>`;
  return {
    subject: `Ihr Angebot${opts.number ? ` ${opts.number}` : ''} von ${opts.agencyName}`,
    html: layout({
      brand,
      heading: `Ihr Angebot ist da${opts.clientName ? `, ${opts.clientName}` : ''}`,
      body: `<strong>${opts.agencyName}</strong> hat ein Angebot für Sie erstellt. Sie können es online ansehen und direkt digital unterschreiben — ganz ohne Ausdrucken.
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;background:#FAF9F6;border-radius:14px;border-left:3px solid ${accent};">
          <tr><td style="padding:16px 18px;">
            <div style="font-size:15px;font-weight:800;color:#0A0A0A;margin-bottom:8px;">${opts.title}</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${opts.number ? detailRow('Angebotsnummer', opts.number) : ''}
              ${detailRow('Gesamtbetrag', opts.totalFormatted)}
              ${opts.validUntilFormatted ? detailRow('Gültig bis', opts.validUntilFormatted) : ''}
            </table>
          </td></tr>
        </table>`,
      cta: { label: 'Angebot ansehen & unterschreiben', url: opts.url },
      footer: `Dieses Angebot wurde von ${opts.agencyName} über epssys versendet. Der Anmeldelink ist zeitlich begrenzt gültig — Sie können jederzeit einen neuen anfordern.`,
    }),
  };
}

export function notificationEmail(opts: { agencyName?: string; accentColor?: string; heading: string; body: string; url: string; ctaLabel?: string }): { subject: string; html: string } {
  return {
    subject: opts.heading,
    html: layout({
      brand: { agencyName: opts.agencyName, accentColor: opts.accentColor },
      heading: opts.heading,
      body: opts.body,
      cta: { label: opts.ctaLabel || 'Öffnen', url: opts.url },
    }),
  };
}
