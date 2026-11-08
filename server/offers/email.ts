/**
 * Soft offer e-mails via Resend: a copy to the customer and a notification to sales, both with
 * the PDF attached. The customer mail carries only our text (plus their name), never their free-text
 * note, so the form cannot be used to send arbitrary content to third parties.
 */
import { BRAND } from '../../src/config/brand';
import type { Locale } from '../../src/quote/i18n';

export interface OfferMail {
  locale: Locale;
  number: string;
  quoteId: number;
  total: string;
  validUntil: string;
  containers: number;
  netTons: string;
  customer: { name: string; company: string; email: string; country: string; phone: string; note: string };
  pdf: Uint8Array;
  siteOrigin: string;
}

export interface MailConfig {
  apiKey: string;
  from: string;
  salesTo: string;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function base64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const COPY = {
  en: {
    subject: (n: string) => `Your soft offer ${n} · ${BRAND.name}`,
    hello: (name: string) => `Dear ${name},`,
    body: (n: string) =>
      `Thank you for your request. Your soft offer ${n} is attached as a PDF.`,
    total: 'Total',
    valid: 'Valid until',
    next: 'Prices are indicative and become binding only with a confirmed proforma invoice. Reply to this e-mail if you would like to proceed or change anything; our sales team will get back to you.',
    regards: `${BRAND.name} sales team`,
  },
  tr: {
    subject: (n: string) => `Ön teklifiniz ${n} · ${BRAND.name}`,
    hello: (name: string) => `Sayın ${name},`,
    body: (n: string) => `Talebiniz için teşekkür ederiz. ${n} numaralı ön teklifiniz PDF olarak ektedir.`,
    total: 'Toplam',
    valid: 'Geçerlilik',
    next: 'Fiyatlar bilgi amaçlıdır; onaylı proforma fatura ile bağlayıcı olur. Devam etmek ya da bir değişiklik yapmak isterseniz bu e-postayı yanıtlayın; satış ekibimiz size dönüş yapacaktır.',
    regards: `${BRAND.name} satış ekibi`,
  },
} as const;

async function send(cfg: MailConfig, payload: Record<string, unknown>): Promise<boolean> {
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: cfg.from, ...payload }),
    });
    if (!r.ok) console.error('[quote] Resend error', r.status, await r.text());
    return r.ok;
  } catch (e) {
    console.error('[quote] Resend fetch failed', e);
    return false;
  }
}

/** Returns true when the customer copy was accepted by Resend. */
export async function sendOfferMails(cfg: MailConfig, m: OfferMail): Promise<boolean> {
  const t = COPY[m.locale];
  const attachment = { filename: `${m.number}.pdf`, content: base64(m.pdf) };
  const c = m.customer;

  const customerHtml = `
<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1C1410;max-width:560px">
  <p>${esc(t.hello(c.name))}</p>
  <p>${esc(t.body(m.number))}</p>
  <table cellpadding="6" style="border-collapse:collapse;margin:12px 0">
    <tr><td style="color:#7A6652">${t.total}</td><td><strong>${esc(m.total)}</strong></td></tr>
    <tr><td style="color:#7A6652">${t.valid}</td><td>${esc(m.validUntil)}</td></tr>
  </table>
  <p style="color:#7A6652;font-size:13px">${esc(t.next)}</p>
  <p>${esc(t.regards)}<br>${esc(BRAND.contact.phone)}</p>
</div>`.trim();
  const customerText = [t.hello(c.name), '', t.body(m.number), '', `${t.total}: ${m.total}`, `${t.valid}: ${m.validUntil}`, '', t.next, '', t.regards, BRAND.contact.phone].join('\n');

  const customerOk = await send(cfg, {
    to: c.email,
    reply_to: cfg.salesTo,
    subject: t.subject(m.number),
    html: customerHtml,
    text: customerText,
    attachments: [attachment],
  });

  const rows: [string, string][] = [
    ['Offer', m.number],
    ['Total', m.total],
    ['Containers', `${m.containers} · net ${m.netTons} t`],
    ['Name', c.name],
    ['Company', c.company],
    ['Email', c.email],
    ['Country', c.country],
    ['Phone', c.phone || '-'],
    ['Language', m.locale.toUpperCase()],
    ['Customer copy', customerOk ? 'sent' : 'NOT sent'],
  ];
  const adminUrl = `${m.siteOrigin}/admin/#/quotes/${m.quoteId}`;
  await send(cfg, {
    to: cfg.salesTo,
    reply_to: c.email,
    subject: `[Soft offer] ${m.number} · ${c.company} · ${m.total}`,
    html: `
<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1C1410">
  <h2 style="font-size:18px">New soft offer ${esc(m.number)}</h2>
  <table cellpadding="6" style="border-collapse:collapse">
    ${rows.map(([k, v]) => `<tr><td style="color:#7A6652">${k}</td><td>${esc(v)}</td></tr>`).join('')}
  </table>
  ${c.note ? `<h3 style="font-size:15px">Customer note</h3><pre style="white-space:pre-wrap;font-family:inherit;background:#F7F3EE;padding:12px;border-left:3px solid #C9922A">${esc(c.note)}</pre>` : ''}
  <p><a href="${esc(adminUrl)}">Open in admin</a> · Reply to this e-mail to answer the customer.</p>
</div>`.trim(),
    text: [...rows.map(([k, v]) => `${k}: ${v}`), '', c.note ? `Customer note:\n${c.note}\n` : '', `Admin: ${adminUrl}`].join('\n'),
    attachments: [attachment],
  });

  return customerOk;
}
