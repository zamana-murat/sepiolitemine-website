/**
 * Product screens of the configurator, both shown in a modal <dialog>:
 *   ProductPickerDialog   choose a product + packaging for the active container ("+ Add product")
 *   ProductDetailsDialog  everything about one product ("Product details" next to a container line)
 */
import { useState } from 'preact/hooks';
import type { Catalog, CatalogPackaging, CatalogProduct } from '../lib/quote/types';
import type { Formatters, Locale } from './i18n';
import { STRINGS, optionPriceLabel } from './i18n';
import { Modal } from './Modal';

const DOC_LABELS: Record<Locale, Record<string, string>> = {
  en: { tds: 'TDS', msds: 'SDS', coa: 'CoA', certificate: 'Certificate', other: 'Document' },
  tr: { tds: 'TDS', msds: 'SDS', coa: 'CoA', certificate: 'Sertifika', other: 'Belge' },
};

export function packagingPriceLabel(p: CatalogPackaging, fmt: Formatters, locale: Locale) {
  const t = STRINGS[locale];
  return `${fmt.money(p.priceCents)} ${p.priceBasis === 'per_ton' ? t.perTon : t.perUnit}`;
}

function PackagingMeta(props: { p: CatalogPackaging; fmt: Formatters; locale: Locale }) {
  const { p, fmt, locale } = props;
  const t = STRINGS[locale];
  return (
    <span class="q-pack__meta">
      {t.netGross(fmt.kg(p.netWeightKg), fmt.kg(p.grossWeightKg))} · {fmt.mm(p.lengthMm)} × {fmt.mm(p.widthMm)} ×{' '}
      {fmt.mm(p.heightMm)} mm · {t.tiers(p.maxTiers)}
    </span>
  );
}

/** Full product information (used in the details dialog and expandable in the picker). */
export function ProductInfo(props: { product: CatalogProduct; fmt: Formatters; locale: Locale; showPackagings?: boolean }) {
  const { product: pr, fmt, locale } = props;
  const t = STRINGS[locale];
  const description = locale === 'tr' ? pr.descriptionTr : pr.descriptionEn;
  return (
    <div class="q-info">
      <p class="q-product__desc">{description || t.noDescription}</p>
      {pr.hsCode && (
        <p class="q-info__meta">
          {t.hsCode}: <strong>{pr.hsCode}</strong>
        </p>
      )}

      {pr.specs.length > 0 && (
        <section class="q-info__block">
          <h3>{t.specs}</h3>
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
        </section>
      )}

      {props.showPackagings && (
        <section class="q-info__block">
          <h3>{t.packagings}</h3>
          <ul class="q-info__packs">
            {pr.packagings.map((p) => (
              <li key={p.id}>
                <span class="q-pack__name">
                  <span class="q-tag">{p.type === 'bigbag' ? t.bigbag : t.pallet}</span> {locale === 'tr' ? p.nameTr : p.nameEn}
                </span>
                <PackagingMeta p={p} fmt={fmt} locale={locale} />
                <span class="q-pack__price">{packagingPriceLabel(p, fmt, locale)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pr.options.length > 0 && (
        <section class="q-info__block">
          <h3>{t.productOptions}</h3>
          <ul class="q-applied">
            {pr.options.map((o) => (
              <li key={o.id}>
                <span>
                  {locale === 'tr' ? o.nameTr : o.nameEn}
                  {o.isMandatory && ` (${t.included})`}
                </span>
                <span>{optionPriceLabel(o, fmt, locale)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pr.documents.length > 0 && (
        <section class="q-info__block">
          <h3>{t.documents}</h3>
          <div class="q-docs">
            {pr.documents.map((d) => (
              <a key={d.id} href={d.url} target="_blank" rel="noopener" class="q-doc">
                {DOC_LABELS[locale][d.docType] ?? d.docType}: {locale === 'tr' ? d.titleTr : d.titleEn}
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PickerCard(props: {
  product: CatalogProduct;
  color: string;
  onAdd: (p: CatalogPackaging) => void;
  fmt: Formatters;
  locale: Locale;
}) {
  const { product: pr, fmt, locale } = props;
  const t = STRINGS[locale];
  const [open, setOpen] = useState(false);
  const name = locale === 'tr' ? pr.nameTr : pr.nameEn;
  const description = locale === 'tr' ? pr.descriptionTr : pr.descriptionEn;
  return (
    <article class="q-product q-card">
      <header class="q-product__head">
        <span class="q-swatch" style={{ background: props.color }} aria-hidden="true" />
        <h3>{name}</h3>
      </header>
      {!open && description && <p class="q-product__desc q-clamp">{description}</p>}
      <button type="button" class="q-link q-product__more" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? t.hideDetails : t.details}
      </button>
      {open && <ProductInfo product={pr} fmt={fmt} locale={locale} />}
      <ul class="q-packs">
        {pr.packagings.map((p) => (
          <li key={p.id} class="q-pack">
            <div class="q-pack__info">
              <span class="q-pack__name">
                <span class="q-tag">{p.type === 'bigbag' ? t.bigbag : t.pallet}</span> {locale === 'tr' ? p.nameTr : p.nameEn}
              </span>
              <PackagingMeta p={p} fmt={fmt} locale={locale} />
              <span class="q-pack__price">{packagingPriceLabel(p, fmt, locale)}</span>
            </div>
            <button type="button" class="q-btn q-btn--add" onClick={() => props.onAdd(p)}>
              {t.add}
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function ProductPickerDialog(props: {
  catalog: Catalog;
  containerIndex: number;
  colorOf: (productId: number) => string;
  onAdd: (p: CatalogPackaging) => void;
  onClose: () => void;
  fmt: Formatters;
  locale: Locale;
}) {
  const t = STRINGS[props.locale];
  return (
    <Modal title={t.chooseProduct(props.containerIndex + 1)} onClose={props.onClose} wide locale={props.locale}>
      <p class="q-hint">{t.productsHint}</p>
      <div class="q-picker-grid">
        {props.catalog.products.map((p) => (
          <PickerCard
            key={p.id}
            product={p}
            color={props.colorOf(p.id)}
            onAdd={props.onAdd}
            fmt={props.fmt}
            locale={props.locale}
          />
        ))}
      </div>
    </Modal>
  );
}

export function ProductDetailsDialog(props: { product: CatalogProduct; onClose: () => void; fmt: Formatters; locale: Locale }) {
  const name = props.locale === 'tr' ? props.product.nameTr : props.product.nameEn;
  return (
    <Modal title={name} onClose={props.onClose} locale={props.locale}>
      <ProductInfo product={props.product} fmt={props.fmt} locale={props.locale} showPackagings />
    </Modal>
  );
}
