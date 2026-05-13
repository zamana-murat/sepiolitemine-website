/**
 * functions/api/contact.ts — Cloudflare Pages Function
 *
 * Receives contact form POST, validates (honeypot + email + required fields),
 * sends email via Resend API.
 *
 * Required environment variables (set in Cloudflare Pages → Settings → Variables):
 *   RESEND_API_KEY      — Secret. Get from resend.com → API Keys
 *   CONTACT_TO          — (Optional) override recipient. Default: info@sepiolitemine.com
 *   CONTACT_FROM        — (Optional) override sender. Default: noreply@sepiolitemine.com
 *
 * Resend domain (sepiolitemine.com) must be verified in Resend dashboard with
 * DKIM/SPF DNS records (Phase 4 — `docs/procedures/setup.md`).
 */

interface Env {
  RESEND_API_KEY: string;
  CONTACT_TO?: string;
  CONTACT_FROM?: string;
}

interface ContactPayload {
  name?: string;
  email?: string;
  company?: string;
  country?: string;
  phone?: string;
  subject?: string;
  message?: string;
  website?: string; // honeypot
  locale?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let payload: ContactPayload;

  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON' }, 400);
  }

  // Honeypot — if the hidden `website` field has anything, it's a bot
  if (payload.website && payload.website.trim().length > 0) {
    // Pretend success so bots don't learn the trap
    return jsonResponse({ ok: true });
  }

  // Required field validation
  const name = (payload.name ?? '').trim();
  const email = (payload.email ?? '').trim();
  const message = (payload.message ?? '').trim();

  if (!name || name.length < 2 || name.length > 200) {
    return jsonResponse({ ok: false, error: 'Invalid name' }, 400);
  }
  if (!email || !EMAIL_RE.test(email) || email.length > 200) {
    return jsonResponse({ ok: false, error: 'Invalid email' }, 400);
  }
  if (!message || message.length < 10 || message.length > 5000) {
    return jsonResponse({ ok: false, error: 'Message must be 10–5000 characters' }, 400);
  }

  // Sanity-clip optional fields
  const company = (payload.company ?? '').trim().slice(0, 200);
  const country = (payload.country ?? '').trim().slice(0, 100);
  const phone = (payload.phone ?? '').trim().slice(0, 50);
  const subject = (payload.subject ?? 'quote').trim().slice(0, 50);
  const locale = (payload.locale ?? 'en').trim().slice(0, 5);

  const subjectLine =
    locale === 'tr'
      ? `[Sepiolite Mine TR] ${subject} — ${name}${company ? ` (${company})` : ''}`
      : `[Sepiolite Mine] ${subject} — ${name}${company ? ` (${company})` : ''}`;

  const to = env.CONTACT_TO ?? 'info@sepiolitemine.com';
  const from = env.CONTACT_FROM ?? 'Sepiolite Mine <noreply@sepiolitemine.com>';

  const htmlBody = `
    <h2>New contact request</h2>
    <table cellpadding="6" style="border-collapse:collapse;font-family:sans-serif;">
      <tr><td><strong>Name</strong></td><td>${escapeHtml(name)}</td></tr>
      <tr><td><strong>Email</strong></td><td>${escapeHtml(email)}</td></tr>
      <tr><td><strong>Company</strong></td><td>${escapeHtml(company || '—')}</td></tr>
      <tr><td><strong>Country</strong></td><td>${escapeHtml(country || '—')}</td></tr>
      <tr><td><strong>Phone</strong></td><td>${escapeHtml(phone || '—')}</td></tr>
      <tr><td><strong>Subject</strong></td><td>${escapeHtml(subject)}</td></tr>
      <tr><td><strong>Locale</strong></td><td>${escapeHtml(locale)}</td></tr>
    </table>
    <h3>Message</h3>
    <pre style="white-space:pre-wrap;font-family:sans-serif;font-size:14px;line-height:1.6;background:#fbf9f4;padding:12px;border-left:3px solid #C9922A;">${escapeHtml(message)}</pre>
    <hr/>
    <p style="font-size:12px;color:#7A6652;">Submitted via sepiolitemine.com contact form. Reply directly to this email to respond to the sender.</p>
  `.trim();

  const textBody = [
    `New contact request`,
    ``,
    `Name:    ${name}`,
    `Email:   ${email}`,
    `Company: ${company || '-'}`,
    `Country: ${country || '-'}`,
    `Phone:   ${phone || '-'}`,
    `Subject: ${subject}`,
    `Locale:  ${locale}`,
    ``,
    `Message:`,
    message,
  ].join('\n');

  if (!env.RESEND_API_KEY) {
    console.error('[contact] RESEND_API_KEY env var missing');
    return jsonResponse({ ok: false, error: 'Server configuration error' }, 500);
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        reply_to: email,
        subject: subjectLine,
        html: htmlBody,
        text: textBody,
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error('[contact] Resend API error:', r.status, errText);
      return jsonResponse({ ok: false, error: 'Mail provider error' }, 502);
    }

    return jsonResponse({ ok: true });
  } catch (e) {
    console.error('[contact] Fetch failed:', e);
    return jsonResponse({ ok: false, error: 'Network error' }, 502);
  }
};

// Block other methods
export const onRequest: PagesFunction = async ({ request }) => {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'POST' },
    });
  }
  // POST handled by onRequestPost above
  return new Response('Use POST', { status: 405 });
};
