/**
 * Full-width order summary below the containers: every line, service and container count in one
 * table, then the delivery term, order services, totals and the soft offer request.
 */
import { Fragment } from 'preact';
import type { AppliedOption, Catalog, OrderRequest, QuoteResult } from '../lib/quote/types';
import type { Formatters, Locale } from './i18n';
import { STRINGS, deliveryLabel, issueText, optionPriceLabel } from './i18n';
import { OptionPicker } from './OptionPicker';
import { RequestOffer } from './RequestOffer';

function OptionRows(props: { options: AppliedOption[]; fmt: Formatters; locale: Locale; indent?: boolean }) {
  const { fmt, locale } = props;
  return (
    <>
      {props.options.map((o) => (
        <tr key={o.optionId} class="q-sum-table__opt">
          <td colSpan={4} class={props.indent ? 'q-indent' : ''}>
            + {locale === 'tr' ? o.nameTr : o.nameEn} <small>({optionPriceLabel(o, fmt, locale)})</small>
          </td>
          <td class="q-num">{fmt.signedMoney(o.cents)}</td>
        </tr>
      ))}
    </>
  );
}

export function Summary(props: {
  catalog: Catalog;
  result: QuoteResult;
  orderOptionIds: number[];
  onOrderOptions: (ids: number[]) => void;
  deliveryTermId: number | null;
  onDeliveryTerm: (id: number) => void;
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
  const terms = props.catalog.deliveryTerms;

  return (
    <section class="q-panel q-summary" aria-labelledby="q-summary-title">
      <h2 id="q-summary-title" class="q-panel__title">
        {t.summary}
      </h2>
      <p class="q-hint">{t.summaryHint}</p>

      <div class="q-summary__grid">
        <div class="q-summary__detail">
          <div class="q-table-wrap">
            <table class="q-sum-table">
              <thead>
                <tr>
                  <th scope="col">{t.colProduct}</th>
                  <th scope="col" class="q-num">
                    {t.colQty}
                  </th>
                  <th scope="col" class="q-num">
                    {t.colNet}
                  </th>
                  <th scope="col" class="q-num">
                    {t.colUnitPrice}
                  </th>
                  <th scope="col" class="q-num">
                    {t.colAmount}
                  </th>
                </tr>
              </thead>
              {r.containers.map((c, i) => (
                <tbody key={i} class="q-sum-table__container">
                  <tr class="q-sum-table__head">
                    <th colSpan={5} scope="rowgroup">
                      {t.container(i + 1)} · {c.code} · {locale === 'tr' ? c.nameTr : c.nameEn}
                      {c.count > 1 && <span class="q-badge">{t.times(c.count)}</span>}
                    </th>
                  </tr>
                  {c.lines.length === 0 && (
                    <tr>
                      <td colSpan={5} class="q-muted">
                        {t.empty}
                      </td>
                    </tr>
                  )}
                  {c.lines.map((l) => (
                    <Fragment key={l.lineIndex}>
                      <tr class="q-sum-table__line">
                        <td>
                          <strong>{locale === 'tr' ? l.productNameTr : l.productNameEn}</strong>
                          <small class="q-block-small">{locale === 'tr' ? l.packagingNameTr : l.packagingNameEn}</small>
                        </td>
                        <td class="q-num" data-label={t.colQty}>
                          {fmt.kg(l.quantity)}
                        </td>
                        <td class="q-num" data-label={t.colNet}>
                          {fmt.tons(l.netKg)}
                        </td>
                        <td class="q-num" data-label={t.colUnitPrice}>
                          {fmt.money(l.unitPriceCents)} {l.priceBasis === 'per_ton' ? t.perTon : t.perUnit}
                        </td>
                        <td class="q-num" data-label={t.colAmount}>
                          {fmt.money(l.goodsCents)}
                        </td>
                      </tr>
                      <OptionRows options={l.options} fmt={fmt} locale={locale} indent />
                    </Fragment>
                  ))}
                  {c.options.length > 0 && (
                    <>
                      <tr class="q-sum-table__sub">
                        <td colSpan={5}>{t.containerServices}</td>
                      </tr>
                      <OptionRows options={c.options} fmt={fmt} locale={locale} />
                    </>
                  )}
                  {c.count > 1 && (
                    <tr class="q-sum-table__subtotal q-sum-table__subtotal--unit">
                      <td colSpan={4}>
                        {t.subtotal} · {t.oneContainer}
                        {c.load && <small> · net {fmt.tons(c.load.netKg)} t</small>}
                      </td>
                      <td class="q-num">{fmt.money(c.unitTotalCents)}</td>
                    </tr>
                  )}
                  <tr class="q-sum-table__subtotal">
                    <td colSpan={4}>
                      {t.subtotal}
                      {c.count > 1 ? ` (${t.times(c.count)})` : ''}
                    </td>
                    <td class="q-num">{fmt.money(c.totalCents)}</td>
                  </tr>
                </tbody>
              ))}
            </table>
          </div>
        </div>

        <div class="q-summary__side">
          {terms.length > 0 && (
            <fieldset class="q-block q-delivery">
              <legend>{t.delivery}</legend>
              {terms.length > 1 && <p class="q-hint">{t.deliveryHint}</p>}
              {terms.map((d) => {
                const payment = locale === 'tr' ? d.paymentTermsTr : d.paymentTermsEn;
                return (
                  <label key={d.id} class="q-opt q-delivery__opt">
                    <input
                      type="radio"
                      name="q-delivery"
                      checked={props.deliveryTermId === d.id}
                      onChange={() => props.onDeliveryTerm(d.id)}
                    />
                    <span class="q-opt__name">{deliveryLabel(d, locale)}</span>
                    <span class="q-opt__price">{d.amount !== 0 ? optionPriceLabel(d, fmt, locale) : ''}</span>
                    {payment && (
                      <span class="q-opt__desc">
                        {t.payment}: {payment}
                      </span>
                    )}
                  </label>
                );
              })}
            </fieldset>
          )}

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
              <dt>
                {t.containersTotal} ({fmt.kg(r.totals.containers)})
              </dt>
              <dd>{fmt.money(r.containersTotalCents)}</dd>
            </div>
            {r.orderOptions.map((o) => (
              <div key={o.optionId}>
                <dt>{locale === 'tr' ? o.nameTr : o.nameEn}</dt>
                <dd>{fmt.signedMoney(o.cents)}</dd>
              </div>
            ))}
            {r.deliveryTerm && r.deliveryTerm.cents !== 0 && (
              <div>
                <dt>{deliveryLabel(r.deliveryTerm, locale)}</dt>
                <dd>{fmt.signedMoney(r.deliveryTerm.cents)}</dd>
              </div>
            )}
            <div class="q-totals__grand">
              <dt>
                {t.total}
                {r.deliveryTerm && <small> · {deliveryLabel(r.deliveryTerm, locale)}</small>}
              </dt>
              <dd>{fmt.money(r.totalCents)}</dd>
            </div>
            <div class="q-totals__meta">
              <dt>{t.netWeight}</dt>
              <dd>{fmt.tons(r.totals.netKg)} t</dd>
            </div>
            <div class="q-totals__meta">
              <dt>{t.grossWeight}</dt>
              <dd>{fmt.tons(r.totals.grossKg)} t</dd>
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
        </div>
      </div>
    </section>
  );
}
