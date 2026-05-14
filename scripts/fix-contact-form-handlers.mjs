#!/usr/bin/env node
/**
 * fix-contact-form-handlers.mjs
 *
 * Inline onsubmit / onclick handlers fail in Astro because <script> blocks
 * are Vite-bundled (module-scoped) and inline HTML attributes look up
 * functions on window. We strip inline handlers and rewrite the script
 * block to use addEventListener.
 *
 * Node fs.writeFileSync('utf8') is used — PowerShell Set-Content corrupts
 * Turkish characters (see EUREKA 2026-05-14).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

function patchFile(filePath, isTr) {
  let content = fs.readFileSync(filePath, 'utf8');
  const before = content.length;

  // 1) Strip inline onsubmit attribute on the contact form
  content = content.replace(
    /<form id="contactForm"[^>]*?>/,
    '<form id="contactForm" novalidate>'
  );

  // 2) Strip every inline `onclick="toggleFaq(this)"` attribute
  content = content.replace(/ onclick="toggleFaq\(this\)"/g, '');

  // 3) Replace the entire <script>...</script> block (the contact-page logic one)
  //    with an addEventListener-based handler. Find script that contains "toggleFaq".
  const scriptRe = /<script>([\s\S]*?toggleFaq[\s\S]*?)<\/script>/;
  if (!scriptRe.test(content)) {
    throw new Error(`No matching <script>...toggleFaq...</script> block in ${filePath}`);
  }

  const tr = {
    invalidEmail: 'Geçersiz e-posta',
    sending: 'Gönderiliyor…',
    success: {
      heading: 'Sorgunuz Alındı',
      body: 'İlginiz için teşekkürler. Satış ekibimiz sorgunuzu inceleyecek ve 24 saat içinde yanıtlayacak.',
      tail: 'Ayrıca <strong>+90 530 490 4740</strong> (WhatsApp) numarasından da bize ulaşabilirsiniz.',
    },
    subjectFallback: 'Sepiyolit sorgusu',
    msgProduct: 'Ürün:    ',
    msgVolume: 'Hacim:   ',
    msgEmpty: '(mesaj yok)',
    errPrefix: 'Gönderilemedi: ',
    errSuffix: '. Lütfen tekrar deneyin veya +90 530 490 4740 numarasını arayın.',
    errUnknown: 'bilinmeyen hata',
    locale: 'tr',
  };
  const en = {
    invalidEmail: 'Invalid email',
    sending: 'Sending…',
    success: {
      heading: 'Enquiry Received',
      body: 'Thank you for your interest. Our sales team will review your enquiry and respond within 24 hours.',
      tail: 'You can also reach us at <strong>+90 530 490 4740</strong> (WhatsApp).',
    },
    subjectFallback: 'Sepiolite enquiry',
    msgProduct: 'Product:  ',
    msgVolume: 'Volume:   ',
    msgEmpty: '(no message)',
    errPrefix: 'Could not send: ',
    errSuffix: '. Please try again or call +90 530 490 4740.',
    errUnknown: 'unknown error',
    locale: 'en',
  };
  const L = isTr ? tr : en;

  const newScript = `<script>
    // Astro <script> blocks are Vite-bundled (module-scoped). Inline onsubmit /
    // onclick attributes would fail because they look up function names on the
    // global window. We bind handlers via addEventListener instead.

    // FAQ accordion — event delegation
    document.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.faq-q');
      if (!btn) return;
      const faqItem = btn.parentElement;
      const answer = faqItem?.querySelector<HTMLElement>('.faq-a');
      if (!faqItem || !answer) return;
      const isOpen = answer.classList.contains('open');
      document.querySelectorAll<HTMLElement>('.faq-a.open').forEach((a) => {
        a.classList.remove('open');
        a.parentElement?.querySelector('.faq-q')?.classList.remove('active');
      });
      if (!isOpen) {
        answer.classList.add('open');
        btn.classList.add('active');
      }
    });

    // Contact form submission → POST /api/contact (Cloudflare Pages Function → Resend)
    const form = document.getElementById('contactForm') as HTMLFormElement | null;
    if (form) {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const card = form.closest<HTMLElement>('.contact-form-card');
        const submitBtn = form.querySelector<HTMLButtonElement>('.form-submit');
        if (!card || !submitBtn) return;

        const data = new FormData(form);
        const productSelect = form.querySelector<HTMLSelectElement>('#product');
        const volumeSelect = form.querySelector<HTMLSelectElement>('#volume');
        const productLabel = productSelect?.selectedOptions[0]?.text || '';
        const volumeLabel = volumeSelect?.selectedOptions[0]?.text || '';

        const payload = {
          name: ((data.get('fullName') as string) || '').trim(),
          email: ((data.get('email') as string) || '').trim(),
          company: ((data.get('company') as string) || '').trim(),
          country: ((data.get('country') as string) || '').trim(),
          subject: productLabel || ${JSON.stringify(L.subjectFallback)},
          message: [
            ${JSON.stringify(L.msgProduct)} + productLabel,
            ${JSON.stringify(L.msgVolume)} + volumeLabel,
            '',
            ((data.get('message') as string) || '').trim() || ${JSON.stringify(L.msgEmpty)},
          ].join('\\n'),
          website: (data.get('website') as string) || '', // honeypot
          locale: ${JSON.stringify(L.locale)},
        };

        const originalLabel = submitBtn.textContent || '';
        submitBtn.disabled = true;
        submitBtn.textContent = ${JSON.stringify(L.sending)};
        form.querySelector('.form-error')?.remove();

        try {
          const r = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const result = await r.json().catch(() => ({ ok: false, error: 'Bad response' }));

          if (r.ok && result.ok) {
            card.innerHTML =
              '<div style="text-align:center;padding:3rem 1.5rem;">' +
              '<div style="font-size:3rem;margin-bottom:1rem;color:var(--gold);">&#10003;</div>' +
              '<h2 style="font-family:Playfair Display,serif;font-size:1.6rem;color:var(--earth);margin-bottom:1rem;">' + ${JSON.stringify(L.success.heading)} + '</h2>' +
              '<p style="font-size:0.95rem;color:var(--text-light);line-height:1.7;max-width:400px;margin:0 auto 1.5rem;">' + ${JSON.stringify(L.success.body)} + '</p>' +
              '<p style="font-size:0.85rem;color:var(--stone);">' + ${JSON.stringify(L.success.tail)} + '</p>' +
              '</div>';
            return;
          }
          throw new Error(result.error || ('HTTP ' + r.status));
        } catch (err) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalLabel;
          const errBox = document.createElement('div');
          errBox.className = 'form-error';
          errBox.style.cssText = 'margin-top:1rem;padding:0.85rem 1rem;border-left:3px solid #b3261e;background:#fdecea;color:#5b1612;font-size:0.88rem;border-radius:0 6px 6px 0;';
          errBox.textContent = ${JSON.stringify(L.errPrefix)} + (err instanceof Error ? err.message : ${JSON.stringify(L.errUnknown)}) + ${JSON.stringify(L.errSuffix)};
          form.appendChild(errBox);
        }
      });
    }
  </script>`;

  content = content.replace(scriptRe, newScript);

  // 4) Add honeypot block inside <form> if not present
  if (!content.includes('name="website"')) {
    const honeyHtml = isTr
      ? `<form id="contactForm" novalidate>
              {/* Honeypot — bot tuzağı; insan görmez, backend sessizce reddeder. */}
              <div aria-hidden="true" style="position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden;">
                <label for="website">Web sitesi (boş bırakın)</label>
                <input type="text" id="website" name="website" tabindex="-1" autocomplete="off" />
              </div>`
      : `<form id="contactForm" novalidate>
              {/* Honeypot — hidden from humans, attractive to bots. Backend rejects any submission with this filled. */}
              <div aria-hidden="true" style="position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden;">
                <label for="website">Website (leave blank)</label>
                <input type="text" id="website" name="website" tabindex="-1" autocomplete="off" />
              </div>`;
    content = content.replace(/<form id="contactForm" novalidate>/, honeyHtml);
  }

  fs.writeFileSync(filePath, content, 'utf8');
  const after = content.length;
  console.log(`✓ ${path.relative(projectRoot, filePath)} (${before} → ${after} chars)`);
}

patchFile(path.join(projectRoot, 'src', 'pages', 'contact', 'index.astro'), false);
patchFile(path.join(projectRoot, 'src', 'pages', 'tr', 'contact', 'index.astro'), true);
