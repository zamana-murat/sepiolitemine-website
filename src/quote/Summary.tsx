import type { Catalog, OrderRequest, QuoteResult } from '../lib/quote/types';
import type { Formatters, Locale } from './i18n';
import { STRINGS, issueText } from './i18n';
import { OptionPicker } from './OptionPicker';
import { RequestOffer } from './RequestOffer';

export function Summary(props: {
  catalog: Catalog;
  result: QuoteResult;
  orderOptionIds: number[];
  onOrderOptions: (ids: number[]) => void;
  onReset: () => void;
  siteKey: string | null;
  request: OrderRequest;
  onCatalogStale: () => void;
  fmt: Formatters;
  locale: Locale;
}) {
  const { result: r, fmt, locale } = props;
  const t = STRINGS[locale];
  const globalErrors = r.errors.filter((e) => !e.path.startsWith('containers.'));

  return (
    <aside class="q-panel q-summary" aria-labelledby="q-summary-title">
      <h2 id="q-summary-title" class="q-panel__title">
        {t.summary}
      </h2>

      <ul class="q-sum-list">
        {r.containers.map((c, i) => (
          <li key={i}>
            <span>
              {t.container(i + 1)} · {c.code}
              <small>{fmt.tons(c.load?.netKg ?? 0)} t</small>
            </span>
            <span>{fmt.money(c.totalCents)}</span>
          </li>
        ))}
      </ul>

      {props.catalog.orderOptions.length > 0 && (
        <div class="q-block">
          <h4>{t.orderServices}</h4>
          <OptionPicker
            name="order"
            options={props.catalog.orderOptions}
            selected={props.orderOptionIds}
            onChange={props.onOrderOptions}
            fmt={fmt}
            locale={locale}
          />
        </div>
      )}

      <dl class="q-totals" aria-live="polite">
        <div>
          <dt>{t.containersTotal}</dt>
          <dd>{fmt.money(r.containersTotalCents)}</dd>
        </div>
        {r.orderOptions.map((o) => (
          <div key={o.optionId}>
            <dt>{locale === 'tr' ? o.nameTr : o.nameEn}</dt>
            <dd>{fmt.signedMoney(o.cents)}</dd>
          </div>
        ))}
        <div class="q-totals__grand">
          <dt>{t.total}</dt>
          <dd>{fmt.money(r.totalCents)}</dd>
        </div>
        <div class="q-totals__meta">
          <dt>{t.netWeight}</dt>
          <dd>{fmt.tons(r.totals.netKg)} t</dd>
        </div>
        <div class="q-totals__meta">
          <dt>{t.units}</dt>
          <dd>{fmt.kg(r.totals.units)}</dd>
        </div>
      </dl>

      {globalErrors.length > 0 && (
        <ul class="q-issues q-issues--error" role="alert">
          {globalErrors.map((e, i) => (
            <li key={i}>{issueText(locale, e)}</li>
          ))}
        </ul>
      )}

      <RequestOffer
        siteKey={props.siteKey}
        request={props.request}
        result={r}
        locale={locale}
        fmt={fmt}
        onCatalogStale={props.onCatalogStale}
      />

      <p class="q-disclaimer">{t.disclaimer}</p>
      <p class="q-hint">
        {t.savedLocally}{' '}
        <button type="button" class="q-link" onClick={props.onReset}>
          {t.reset}
        </button>
      </p>
    </aside>
  );
}
