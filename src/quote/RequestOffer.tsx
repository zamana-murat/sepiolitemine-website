/**
 * Soft offer request: contact form + Turnstile → POST /api/quote/requests. The server recomputes
 * the offer from its own catalog; the total shown here is sent only to detect price changes.
 * The Turnstile script is loaded only when the form opens (no third-party JS before that).
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { OrderRequest, QuoteResult } from '../lib/quote/types';
import type { Formatters, Locale } from './i18n';
import { STRINGS } from './i18n';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let turnstileLoading: Promise<void> | null = null;
function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  turnstileLoading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = TURNSTILE_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      turnstileLoading = null;
      reject(new Error('turnstile'));
    };
    document.head.appendChild(s);
  });
  return turnstileLoading;
}

type Fields = { name: string; company: string; email: string; country: string; phone: string; note: string };
const EMPTY: Fields = { name: '', company: '', email: '', country: '', phone: '', note: '' };
const REQUIRED: (keyof Fields)[] = ['name', 'company', 'email', 'country'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Done = { number: string; pdfUrl: string; emailStatus: 'sent' | 'failed' | 'skipped'; email: string };
type Phase = 'idle' | 'form' | 'sending' | 'done';

export function RequestOffer(props: {
  siteKey: string | null;
  request: OrderRequest;
  result: QuoteResult;
  locale: Locale;
  fmt: Formatters;
  /** Re-fetch the catalog after the server reported changed prices / options. */
  onCatalogStale: () => void;
}) {
  const { locale, result, fmt } = props;
  const t = STRINGS[locale];
  const prefix = locale === 'tr' ? '/tr' : '';
  const [phase, setPhase] = useState<Phase>('idle');
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof Fields | 'consent', string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [done, setDone] = useState<Done | null>(null);
  const widgetEl = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const requestKey = JSON.stringify(props.request);

  // A finished offer belongs to the selection it was made for.
  useEffect(() => {
    if (phase === 'done') {
      setPhase('idle');
      setDone(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  // Mount the Turnstile widget when the form opens.
  useEffect(() => {
    if (phase !== 'form' || !props.siteKey || widgetId.current) return;
    let cancelled = false;
    loadTurnstile()
      .then(() => {
        if (cancelled || !widgetEl.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(widgetEl.current, {
          sitekey: props.siteKey,
          language: locale,
          callback: (tok: string) => setToken(tok),
          'expired-callback': () => setToken(''),
          'error-callback': () => setToken(''),
        });
      })
      .catch(() => setError(t.errBot));
    return () => {
      cancelled = true;
    };
  }, [phase, props.siteKey, locale, t.errBot]);

  // Drop the widget when the form closes.
  useEffect(() => {
    if (phase === 'idle' || phase === 'done') {
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
      setToken('');
    }
  }, [phase]);

  const resetWidget = () => {
    setToken('');
    if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
  };

  const canRequest = result.ok && result.totals.units > 0;

  if (!props.siteKey) {
    return (
      <p class="q-hint">
        {t.formUnavailable} <a href={`${prefix}/contact/`}>{t.contactPage}</a>
      </p>
    );
  }

  if (phase === 'done' && done) {
    return (
      <div class="q-done" role="status">
        <p class="q-done__title">{t.done(done.number)}</p>
        <a class="btn btn-primary q-cta" href={done.pdfUrl} download={`${done.number}.pdf`}>
          {t.download}
        </a>
        <p class="q-hint">{done.emailStatus === 'sent' ? t.emailSent(done.email) : done.emailStatus === 'failed' ? t.emailNotSent : ''}</p>
        <p class="q-hint">{t.newOffer}</p>
      </div>
    );
  }

  if (phase === 'idle') {
    return (
      <>
        <button type="button" class="btn btn-primary q-cta" disabled={!canRequest} onClick={() => setPhase('form')}>
          {t.requestOffer}
        </button>
        <p class="q-hint">{result.totals.units > 0 && !result.ok ? t.fixIssues : t.requestIntro}</p>
      </>
    );
  }

  const set = (k: keyof Fields) => (e: Event) => {
    const v = (e.currentTarget as HTMLInputElement).value;
    setFields((f) => ({ ...f, [k]: v }));
    if (fieldErrors[k]) {
      const rest = { ...fieldErrors, [k]: undefined };
      setFieldErrors(rest);
      // The summary message goes once the last flagged field is edited.
      if (error === t.errFields && !Object.values(rest).some(Boolean)) setError(null);
    }
  };

  const validate = () => {
    const fe: typeof fieldErrors = {};
    for (const k of REQUIRED) if (fields[k].trim().length < 2) fe[k] = t.errRequired;
    if (!fe.email && !EMAIL_RE.test(fields.email.trim())) fe.email = t.errEmail;
    if (!consent) fe.consent = t.errRequired;
    setFieldErrors(fe);
    return Object.keys(fe).length === 0;
  };

  const submit = async (e: Event) => {
    e.preventDefault();
    setError(null);
    if (!validate()) {
      setError(t.errFields);
      return;
    }
    if (!token) {
      setError(t.botCheck);
      return;
    }
    setPhase('sending');
    let res: Response;
    let json: { ok: boolean; data?: Omit<Done, 'email'>; error?: string; details?: unknown } | null = null;
    try {
      res = await fetch('/api/quote/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          locale,
          customer: fields,
          order: props.request,
          expectedTotalCents: result.totalCents,
          turnstileToken: token,
          consent,
          website: honeypot,
        }),
      });
      json = await res.json().catch(() => null);
    } catch {
      setPhase('form');
      setError(t.errGeneric);
      resetWidget();
      return;
    }

    if (res.status === 201 && json?.ok && json.data) {
      setDone({ ...json.data, email: fields.email.trim() });
      setPhase('done');
      return;
    }

    setPhase('form');
    resetWidget(); // a Turnstile token is single-use
    const code = json?.error;
    if (res.status === 409 && code === 'price_changed') {
      const total = (json?.details as { totalCents?: number } | undefined)?.totalCents;
      setError(t.errPriceChanged(total !== undefined ? fmt.money(total) : ''));
      props.onCatalogStale();
    } else if (res.status === 422) {
      setError(t.errInvalid);
      props.onCatalogStale();
    } else if (res.status === 429) setError(t.errRate);
    else if (res.status === 403) setError(t.errBot);
    else if (res.status === 400 && Array.isArray(json?.details)) {
      const fe: typeof fieldErrors = {};
      for (const d of json.details as { path: string }[]) {
        const k = d.path.replace(/^customer\./, '') as keyof Fields;
        if (k in EMPTY) fe[k] = k === 'email' ? t.errEmail : t.errRequired;
      }
      setFieldErrors(fe);
      setError(t.errFields);
    } else setError(t.errGeneric);
  };

  const input = (k: keyof Fields, label: string, opts: { type?: string; autocomplete?: string; required?: boolean } = {}) => (
    <label class={`q-field${fieldErrors[k] ? ' q-field--error' : ''}`}>
      <span class="q-field__label">{label}</span>
      <input
        type={opts.type ?? 'text'}
        value={fields[k]}
        onInput={set(k)}
        autocomplete={opts.autocomplete}
        required={opts.required}
        aria-invalid={fieldErrors[k] ? true : undefined}
        maxLength={k === 'company' ? 160 : k === 'phone' ? 40 : 120}
      />
      {fieldErrors[k] && <span class="q-field__error">{fieldErrors[k]}</span>}
    </label>
  );

  const sending = phase === 'sending';
  return (
    <form class="q-request" onSubmit={submit} noValidate aria-busy={sending}>
      {input('name', t.fName, { autocomplete: 'name', required: true })}
      {input('company', t.fCompany, { autocomplete: 'organization', required: true })}
      {input('email', t.fEmail, { type: 'email', autocomplete: 'email', required: true })}
      {input('country', t.fCountry, { autocomplete: 'country-name', required: true })}
      {input('phone', t.fPhone, { type: 'tel', autocomplete: 'tel' })}
      <label class="q-field">
        <span class="q-field__label">{t.fNote}</span>
        <textarea rows={3} maxLength={2000} value={fields.note} onInput={set('note')} />
      </label>
      {/* Honeypot: hidden from people, filled by naive bots. */}
      <label class="q-hp" aria-hidden="true">
        Website
        <input type="text" tabIndex={-1} autocomplete="off" value={honeypot} onInput={(e) => setHoneypot(e.currentTarget.value)} />
      </label>
      <label class={`q-consent${fieldErrors.consent ? ' q-field--error' : ''}`}>
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => {
            setConsent(e.currentTarget.checked);
            const rest = { ...fieldErrors, consent: undefined };
            setFieldErrors(rest);
            if (error === t.errFields && !Object.values(rest).some(Boolean)) setError(null);
          }}
        />
        <span>
          {t.consent}{' '}
          <a href={`${prefix}/privacy/`} target="_blank" rel="noopener">
            {t.privacy}
          </a>
          .
        </span>
      </label>
      <div class="q-turnstile" ref={widgetEl} />
      {error && (
        <p class="q-issues q-issues--error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" class="btn btn-primary q-cta" disabled={sending || !canRequest}>
        {sending ? t.submitting : t.submit}
      </button>
      <button type="button" class="q-link" onClick={() => setPhase('idle')} disabled={sending}>
        {t.cancel}
      </button>
    </form>
  );
}
