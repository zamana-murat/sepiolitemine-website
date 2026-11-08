import { useEffect, useState } from 'preact/hooks';
import { maxAdditionalUnits, type LoadItem } from '../lib/quote/loading';
import type { Catalog, CatalogPackaging, CatalogProduct, ContainerResult, QuoteIssue } from '../lib/quote/types';
import { ContainerView } from './ContainerView';
import type { Formatters, Locale } from './i18n';
import { STRINGS, issueText } from './i18n';
import { OptionPicker } from './OptionPicker';
import { packagingPriceLabel } from './ProductPicker';
import { changeContainerType, type DraftContainer, type DraftLine } from './state';

function QtyInput(props: { value: number; onChange: (n: number) => void; label: string; t: (typeof STRINGS)['en'] }) {
  const [text, setText] = useState(String(props.value));
  useEffect(() => {
    if (Number(text) !== props.value) setText(String(props.value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value]);
  const commit = (n: number) => props.onChange(Math.max(1, Math.round(n)));
  return (
    <div class="q-qty">
      <button type="button" class="q-qty__btn" aria-label={props.t.decrease} onClick={() => commit(props.value - 1)} disabled={props.value <= 1}>
        −
      </button>
      <input
        class="q-qty__input"
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        aria-label={props.label}
        value={text}
        onInput={(e) => {
          const v = e.currentTarget.value;
          setText(v);
          const n = Number(v);
          if (v !== '' && Number.isInteger(n) && n >= 1) props.onChange(n);
        }}
        onBlur={() => setText(String(props.value))}
      />
      <button type="button" class="q-qty__btn" aria-label={props.t.increase} onClick={() => commit(props.value + 1)}>
        +
      </button>
    </div>
  );
}

function Gauge(props: { label: string; ratio: number; detail: string; locale: Locale; fmt: Formatters }) {
  const over = props.ratio > 1 + 1e-9;
  return (
    <div class={`q-gauge${over ? ' q-gauge--over' : ''}`}>
      <div class="q-gauge__row">
        <span class="q-gauge__label">{props.label}</span>
        <span class="q-gauge__value">
          {props.fmt.pct(props.ratio)} · {props.detail}
        </span>
      </div>
      <div
        class="q-gauge__track"
        role="meter"
        aria-label={props.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(props.ratio * 100)}
      >
        <div class="q-gauge__fill" style={{ width: `${Math.min(100, props.ratio * 100)}%` }} />
      </div>
    </div>
  );
}

const Issues = (props: { list: QuoteIssue[]; tone: 'error' | 'warn'; locale: Locale }) =>
  props.list.length === 0 ? null : (
    <ul class={`q-issues q-issues--${props.tone}`} role={props.tone === 'error' ? 'alert' : 'status'}>
      {props.list.map((i, k) => (
        <li key={k}>{issueText(props.locale, i)}</li>
      ))}
    </ul>
  );

export function ContainerCard(props: {
  index: number;
  draft: DraftContainer;
  result: ContainerResult | undefined;
  catalog: Catalog;
  packs: Map<number, { packaging: CatalogPackaging; product: CatalogProduct }>;
  active: boolean;
  errors: QuoteIssue[];
  warnings: QuoteIssue[];
  onChange: (next: DraftContainer) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onActivate: () => void;
  canRemove: boolean;
  canDuplicate: boolean;
  colorOf: (productId: number) => string;
  fmt: Formatters;
  locale: Locale;
}) {
  const { draft: d, result: r, fmt, locale } = props;
  const t = STRINGS[locale];
  const type = props.catalog.containers.find((c) => c.id === d.containerTypeId);
  const path = `containers.${props.index}`;
  const own = (list: QuoteIssue[]) => list.filter((i) => i.path === path);
  const ofLine = (list: QuoteIssue[], j: number) => list.filter((i) => i.path === `${path}.lines.${j}`);

  const items: LoadItem[] = d.lines.flatMap((l) => {
    const e = props.packs.get(l.packagingId);
    return e ? [{ packaging: e.packaging, quantity: l.quantity }] : [];
  });

  const setLine = (uid: string, patch: Partial<DraftLine>) =>
    props.onChange({ ...d, lines: d.lines.map((l) => (l.uid === uid ? { ...l, ...patch } : l)) });
  const removeLine = (uid: string) => props.onChange({ ...d, lines: d.lines.filter((l) => l.uid !== uid) });

  const appliedCents = (optionId: number, list: { optionId: number; cents: number }[] | undefined) =>
    list?.find((o) => o.optionId === optionId)?.cents;

  return (
    <article
      class={`q-panel q-container${props.active ? ' q-container--active' : ''}`}
      aria-labelledby={`q-c-${d.uid}`}
    >
      <header class="q-container__head">
        <h3 id={`q-c-${d.uid}`}>{t.container(props.index + 1)}</h3>
        <label class="q-select">
          <span class="q-visually-hidden">{t.containerType}</span>
          <select
            value={String(d.containerTypeId)}
            onChange={(e) => props.onChange(changeContainerType(d, props.catalog, Number(e.currentTarget.value)))}
          >
            {props.catalog.containers.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.code} · {locale === 'tr' ? c.nameTr : c.nameEn}
              </option>
            ))}
          </select>
        </label>
        <div class="q-container__actions">
          {props.active ? (
            <span class="q-badge">{t.selected}</span>
          ) : (
            <button type="button" class="q-btn q-btn--ghost" onClick={props.onActivate}>
              {t.select}
            </button>
          )}
          <button type="button" class="q-btn q-btn--ghost" onClick={props.onDuplicate} disabled={!props.canDuplicate}>
            {t.duplicate}
          </button>
          {props.canRemove && (
            <button type="button" class="q-btn q-btn--ghost q-btn--danger" onClick={props.onRemove}>
              {t.remove}
            </button>
          )}
        </div>
      </header>

      {type && (
        <>
          <div class="q-gauges">
            <Gauge
              label={t.weight}
              ratio={r?.load?.weightUtilization ?? 0}
              detail={t.ofLimit(fmt.tons(r?.load?.grossKg ?? 0), fmt.tons(type.payloadLimitKg))}
              locale={locale}
              fmt={fmt}
            />
            <Gauge
              label={t.floor}
              ratio={r?.load?.floorUtilization ?? 0}
              detail={t.floorOf(fmt.meters(r?.load?.floorLengthUsedMm ?? 0), fmt.meters(type.innerLengthMm))}
              locale={locale}
              fmt={fmt}
            />
          </div>
          <ContainerView container={type} items={items} colorOf={props.colorOf} index={props.index} locale={locale} />
          <p class="q-caption">
            {t.innerSize(fmt.mm(type.innerLengthMm), fmt.mm(type.innerWidthMm), fmt.mm(type.innerHeightMm))} ·{' '}
            {t.stackLegend}
          </p>
        </>
      )}

      <Issues list={own(props.errors)} tone="error" locale={locale} />
      <Issues list={own(props.warnings)} tone="warn" locale={locale} />

      {d.lines.length === 0 ? (
        <p class="q-empty">{t.empty}</p>
      ) : (
        <ul class="q-lines">
          {d.lines.map((l, j) => {
            const e = props.packs.get(l.packagingId);
            if (!e) return null;
            const lr = r?.lines.find((x) => x.lineIndex === j);
            const fillBy = type ? maxAdditionalUnits(type, items, e.packaging) : 0;
            return (
              <li key={l.uid} class="q-line">
                <div class="q-line__main">
                  <span class="q-swatch" style={{ background: props.colorOf(e.product.id) }} aria-hidden="true" />
                  <div class="q-line__name">
                    <strong>{locale === 'tr' ? e.product.nameTr : e.product.nameEn}</strong>
                    <span>
                      {locale === 'tr' ? e.packaging.nameTr : e.packaging.nameEn} · {packagingPriceLabel(e.packaging, fmt, locale)}
                    </span>
                  </div>
                  <QtyInput value={l.quantity} onChange={(n) => setLine(l.uid, { quantity: n })} label={t.quantity} t={t} />
                  <button
                    type="button"
                    class="q-btn q-btn--ghost"
                    title={t.fillTitle}
                    disabled={fillBy === 0}
                    onClick={() => setLine(l.uid, { quantity: l.quantity + fillBy })}
                  >
                    {t.fill}
                    {fillBy > 0 ? ` +${fillBy}` : ''}
                  </button>
                  <span class="q-line__total">{lr ? fmt.money(lr.totalCents) : ''}</span>
                  <button type="button" class="q-icon-btn" aria-label={t.removeLine} onClick={() => removeLine(l.uid)}>
                    ×
                  </button>
                </div>
                <Issues list={ofLine(props.errors, j)} tone="error" locale={locale} />
                {e.product.options.length > 0 && (
                  <details class="q-details q-line__opts" open={l.optionIds.length > 0}>
                    <summary>
                      {t.options}
                      {lr && lr.options.length > 0 && ` · ${fmt.signedMoney(lr.totalCents - lr.goodsCents)}`}
                    </summary>
                    <OptionPicker
                      name={`l-${l.uid}`}
                      options={e.product.options}
                      selected={l.optionIds}
                      onChange={(ids) => setLine(l.uid, { optionIds: ids })}
                      fmt={fmt}
                      locale={locale}
                    />
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {type && type.options.length > 0 && (
        <div class="q-block">
          <h4>{t.containerServices}</h4>
          <OptionPicker
            name={`c-${d.uid}`}
            options={type.options}
            selected={d.optionIds}
            onChange={(ids) => props.onChange({ ...d, optionIds: ids })}
            fmt={fmt}
            locale={locale}
          />
          {r && r.options.length > 0 && (
            <ul class="q-applied">
              {r.options.map((o) => (
                <li key={o.optionId}>
                  <span>{locale === 'tr' ? o.nameTr : o.nameEn}</span>
                  <span>{fmt.signedMoney(appliedCents(o.optionId, r.options) ?? 0)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <footer class="q-container__total">
        <span>{t.subtotal}</span>
        <strong>{fmt.money(r?.totalCents ?? 0)}</strong>
      </footer>
    </article>
  );
}
