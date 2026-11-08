import type { Catalog, CatalogPackaging, CatalogProduct } from '../lib/quote/types';
import type { Formatters, Locale } from './i18n';
import { STRINGS } from './i18n';

const DOC_LABELS: Record<Locale, Record<string, string>> = {
  en: { tds: 'TDS', msds: 'SDS', coa: 'CoA', certificate: 'Certificate', other: 'Document' },
  tr: { tds: 'TDS', msds: 'SDS', coa: 'CoA', certificate: 'Sertifika', other: 'Belge' },
};

export function packagingPriceLabel(p: CatalogPackaging, fmt: Formatters, locale: Locale) {
  const t = STRINGS[locale];
  return `${fmt.money(p.priceCents)} ${p.priceBasis === 'per_ton' ? t.perTon : t.perUnit}`;
}

function ProductCard(props: {
  product: CatalogProduct;
  color: string;
  activeIndex: number;
  onAdd: (p: CatalogPackaging) => void;
  fmt: Formatters;
  locale: Locale;
}) {
  const { product: pr, fmt, locale } = props;
  const t = STRINGS[locale];
  const name = locale === 'tr' ? pr.nameTr : pr.nameEn;
  const description = locale === 'tr' ? pr.descriptionTr : pr.descriptionEn;

  return (
    <article class="q-product">
      <header class="q-product__head">
        <span class="q-swatch" style={{ background: props.color }} aria-hidden="true" />
        <h3>{name}</h3>
      </header>
      {description && <p class="q-product__desc">{description}</p>}

      {pr.specs.length > 0 && (
        <details class="q-details">
          <summary>{t.specs}</summary>
          <table class="q-specs">
            <tbody>
              {pr.specs.map((s, i) => (
                <tr key={i}>
                  <th scope="row">{locale === 'tr' ? s.labelTr : s.labelEn}</th>
                  <td>
                    {s.value}
                    {s.unit ? ` ${s.unit}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {pr.documents.length > 0 && (
        <div class="q-docs" aria-label={t.documents}>
          {pr.documents.map((d) => (
            <a key={d.id} href={d.url} target="_blank" rel="noopener" class="q-doc">
              {DOC_LABELS[locale][d.docType] ?? d.docType}: {locale === 'tr' ? d.titleTr : d.titleEn}
            </a>
          ))}
        </div>
      )}

      <ul class="q-packs">
        {pr.packagings.map((p) => (
          <li key={p.id} class="q-pack">
            <div class="q-pack__info">
              <span class="q-pack__name">
                <span class="q-tag">{p.type === 'bigbag' ? t.bigbag : t.pallet}</span> {locale === 'tr' ? p.nameTr : p.nameEn}
              </span>
              <span class="q-pack__meta">
                {t.netGross(fmt.kg(p.netWeightKg), fmt.kg(p.grossWeightKg))} · {fmt.mm(p.lengthMm)}×{fmt.mm(p.widthMm)}×
                {fmt.mm(p.heightMm)} mm
              </span>
              <span class="q-pack__price">{packagingPriceLabel(p, fmt, locale)}</span>
            </div>
            <button type="button" class="q-btn q-btn--add" onClick={() => props.onAdd(p)}>
              {t.addTo(props.activeIndex + 1)}
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function ProductPicker(props: {
  catalog: Catalog;
  colorOf: (productId: number) => string;
  activeIndex: number;
  onAdd: (p: CatalogPackaging) => void;
  fmt: Formatters;
  locale: Locale;
}) {
  const t = STRINGS[props.locale];
  return (
    <section class="q-panel q-products" aria-labelledby="q-products-title">
      <h2 id="q-products-title" class="q-panel__title">
        {t.products}
      </h2>
      <p class="q-hint">{t.productsHint}</p>
      {props.catalog.products.length === 0 && <p class="q-hint">{t.noProducts}</p>}
      {props.catalog.products.map((p) => (
        <ProductCard
          key={p.id}
          product={p}
          color={props.colorOf(p.id)}
          activeIndex={props.activeIndex}
          onAdd={props.onAdd}
          fmt={props.fmt}
          locale={props.locale}
        />
      ))}
    </section>
  );
}
