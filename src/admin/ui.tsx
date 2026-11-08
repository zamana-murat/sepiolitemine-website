/** Shared admin UI building blocks. Labels are Turkish (internal tool); no em-dash (C8). */
import type { ComponentChildren } from 'preact';
import { createContext } from 'preact';
import { useCallback, useContext, useEffect, useState } from 'preact/hooks';
import { ApiFailure } from './api';
import { fieldLabel, translateMessage } from './messages';
import type { Currency, PriceType } from './types';

/* ───────────── Context ───────────── */

export interface AdminCtx {
  currency: Currency;
  email: string;
  reloadSettings: () => void;
}
export const AdminContext = createContext<AdminCtx>({ currency: 'USD', email: '', reloadSettings: () => {} });
export const useAdmin = () => useContext(AdminContext);

/* ───────────── Formatting ───────────── */

export const formatMoney = (cents: number, currency: Currency) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 2 }).format(cents / 100);

export const formatPercent = (bp: number) =>
  `%${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(bp / 100)}`;

export const formatNumber = (n: number, digits = 0) =>
  new Intl.NumberFormat('tr-TR', { maximumFractionDigits: digits }).format(n);

export const formatBytes = (b: number) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${formatNumber(b / 1024, 1)} KB` : `${formatNumber(b / 1048576, 1)} MB`;

export const PRICE_TYPE_LABELS: Record<PriceType, string> = {
  fixed: 'Sabit tutar',
  per_unit: 'Ambalaj birimi başına',
  per_ton: 'Ton başına',
  per_container: 'Konteyner başına',
  percent: 'Yüzde (mal bedeli üzerinden)',
};

export const formatOptionPrice = (priceType: PriceType, amount: number, currency: Currency) =>
  priceType === 'percent'
    ? formatPercent(amount)
    : `${formatMoney(amount, currency)}${priceType === 'fixed' ? '' : ` / ${PRICE_TYPE_LABELS[priceType].replace(' başına', '').toLowerCase()}`}`;

export function slugify(s: string): string {
  return s
    .replace(/ı/g, 'i')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/* ───────────── Hooks ───────────── */

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fn()
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e) => alive && setError(e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload, setData };
}

/** Runs a mutation, tracking busy/error state; returns true on success. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(e);
      return false;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, run, clear: () => setError(null) };
}

export function useForm<T extends object>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
  }, []);
  return { values, set, reset: setValues };
}

/* ───────────── Components ───────────── */

export function Field(props: { label: string; hint?: string; wide?: boolean; children: ComponentChildren }) {
  return (
    <label class={`adm-field${props.wide ? ' adm-field--wide' : ''}`}>
      <span class="adm-field__label">{props.label}</span>
      {props.children}
      {props.hint && <span class="adm-field__hint">{props.hint}</span>}
    </label>
  );
}

export function TextInput(props: {
  value: string | null;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
  maxLength?: number;
}) {
  const common = {
    value: props.value ?? '',
    placeholder: props.placeholder,
    required: props.required,
    maxLength: props.maxLength,
    class: 'adm-input',
  };
  return props.multiline ? (
    <textarea {...common} rows={3} onInput={(e) => props.onChange(e.currentTarget.value)} />
  ) : (
    <input {...common} type="text" onInput={(e) => props.onChange(e.currentTarget.value)} />
  );
}

/**
 * Numeric input that keeps the user's text while typing ("12," / "1.") and reports the
 * parsed value. `divisor` converts storage units: cents → 100, basis points → 100.
 * Accepts comma as decimal separator.
 */
export function NumInput(props: {
  value: number | null;
  onChange: (v: number | null) => void;
  divisor?: number;
  integer?: boolean;
  nullable?: boolean;
  suffix?: string;
  placeholder?: string;
}) {
  const divisor = props.divisor ?? 1;
  // Turkish display: comma decimal; money/percent (divisor 100) always with 2 decimals.
  const fmt = (v: number | null) =>
    v === null || v === undefined
      ? ''
      : (divisor === 100 ? (v / divisor).toFixed(2) : String(v / divisor)).replace('.', ',');
  const parse = (t: string): number | null | undefined => {
    const s = t.trim().replace(',', '.');
    if (s === '') return props.nullable ? null : undefined;
    const n = Number(s);
    if (!Number.isFinite(n)) return undefined;
    const raw = n * divisor;
    return props.integer ? Math.round(raw) : raw;
  };
  const [text, setText] = useState(fmt(props.value));
  useEffect(() => {
    if (parse(text) !== props.value) setText(fmt(props.value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value]);

  return (
    <span class="adm-num">
      <input
        class="adm-input"
        type="text"
        inputMode="decimal"
        value={text}
        placeholder={props.placeholder}
        aria-invalid={parse(text) === undefined}
        onInput={(e) => {
          const t = e.currentTarget.value;
          setText(t);
          const p = parse(t);
          if (p !== undefined) props.onChange(p);
        }}
      />
      {props.suffix && <span class="adm-num__suffix">{props.suffix}</span>}
    </span>
  );
}

export function Select<V extends string>(props: {
  value: V;
  onChange: (v: V) => void;
  options: { value: V; label: string }[];
}) {
  return (
    <select class="adm-input" value={props.value} onChange={(e) => props.onChange(e.currentTarget.value as V)}>
      {props.options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle(props: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label class="adm-toggle">
      <input
        type="checkbox"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.currentTarget.checked)}
      />
      <span>{props.label}</span>
    </label>
  );
}

export function Button(props: {
  variant?: 'primary' | 'ghost' | 'danger';
  busy?: boolean;
  type?: 'button' | 'submit';
  disabled?: boolean;
  onClick?: (e: MouseEvent) => unknown;
  children: ComponentChildren;
}) {
  const { variant = 'ghost', busy, children, disabled, type = 'button', onClick } = props;
  return (
    <button
      type={type}
      class={`adm-btn adm-btn--${variant}`}
      disabled={busy || Boolean(disabled)}
      onClick={onClick ? (e) => void onClick(e) : undefined}
    >
      {busy ? 'Kaydediliyor…' : children}
    </button>
  );
}

export function ErrorBox(props: { error: unknown }) {
  if (!props.error) return null;
  const e = props.error;
  const message = translateMessage(e instanceof Error ? e.message : String(e));
  const details = e instanceof ApiFailure ? e.details : undefined;
  return (
    <div class="adm-alert adm-alert--error" role="alert">
      <strong>{message}</strong>
      {details && details.length > 0 && (
        <ul>
          {details.map((d) => (
            <li key={d.path + d.message}>
              {d.path && <strong>{fieldLabel(d.path)}:</strong>} {translateMessage(d.message)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Card(props: { title: string; actions?: ComponentChildren; children: ComponentChildren }) {
  return (
    <section class="adm-card">
      <header class="adm-card__head">
        <h2>{props.title}</h2>
        {props.actions && <div class="adm-card__actions">{props.actions}</div>}
      </header>
      <div class="adm-card__body">{props.children}</div>
    </section>
  );
}

export function Loading() {
  return <p class="adm-muted">Yükleniyor…</p>;
}

export function Badge(props: { tone?: 'ok' | 'off' | 'info' | 'warn'; children: ComponentChildren }) {
  return <span class={`adm-badge adm-badge--${props.tone ?? 'info'}`}>{props.children}</span>;
}

/** Strips server-managed fields before a PUT. */
export function payload<T extends object>(row: T): Omit<T, 'id' | 'createdAt' | 'updatedAt'> {
  const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = row as T & {
    id?: unknown;
    createdAt?: unknown;
    updatedAt?: unknown;
  };
  return rest as Omit<T, 'id' | 'createdAt' | 'updatedAt'>;
}
