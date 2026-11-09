/**
 * Container quote configurator (island on /quote/ and /tr/quote/).
 * Catalog comes from /api/quote/catalog; prices and loading are computed in the browser
 * with the same engine the server will use to issue the offer.
 * Layout: containers as tabs (full width) → summary (full width). Product choice and product
 * details open in their own dialog.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { LIMITS, computeQuote } from '../lib/quote/pricing';
import type { CatalogPackaging, CatalogResponse } from '../lib/quote/types';
import { ContainerPanel } from './ContainerCard';
import { STRINGS, formatters, type Locale } from './i18n';
import { ProductDetailsDialog, ProductPickerDialog } from './ProductPicker';
import {
  clearDraft,
  defaultOptionIds,
  duplicateContainer,
  emptyDraft,
  loadDraft,
  newContainer,
  packagingIndex,
  physicalCount,
  sanitize,
  saveDraft,
  toRequest,
  uid,
  type Draft,
  type DraftContainer,
} from './state';
import { Summary } from './Summary';
import { productColors } from './colors';

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; catalog: CatalogResponse };
type Dialog = { kind: 'picker' } | { kind: 'details'; productId: number } | null;

export default function Configurator(props: { locale: Locale }) {
  const { locale } = props;
  const t = STRINGS[locale];
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  /** silent: keep the page as is while refreshing (after the server reported a price change). */
  const fetchCatalog = useCallback((silent = false) => {
    if (!silent) setLoad({ status: 'loading' });
    fetch('/api/quote/catalog', { headers: { Accept: 'application/json' }, cache: silent ? 'reload' : 'default' })
      .then((r) => r.json() as Promise<{ ok: boolean; data?: CatalogResponse }>)
      .then((j) => {
        if (!j.ok || !j.data) throw new Error('catalog');
        const catalog = j.data;
        setLoad({ status: 'ready', catalog });
        setDraft((current) => (catalog.containers.length > 0 ? sanitize(current ?? loadDraft(), catalog) : null));
      })
      .catch(() => {
        if (!silent) setLoad({ status: 'error' });
      });
  }, []);

  useEffect(() => fetchCatalog(), [fetchCatalog]);
  useEffect(() => {
    if (draft) saveDraft(draft);
  }, [draft]);

  const catalog = load.status === 'ready' ? load.catalog : null;
  const fmt = useMemo(() => formatters(locale, catalog?.currency ?? 'USD'), [locale, catalog?.currency]);
  const packs = useMemo(() => (catalog ? packagingIndex(catalog) : new Map()), [catalog]);
  const colorOf = useMemo(() => productColors(catalog), [catalog]);
  const result = useMemo(
    () => (catalog && draft ? computeQuote(catalog, toRequest(draft)) : null),
    [catalog, draft],
  );

  if (load.status === 'loading') return <p class="q-status">{t.loading}</p>;
  if (load.status === 'error' || !catalog) {
    return (
      <div class="q-status q-status--error" role="alert">
        <p>{t.loadError}</p>
        <button type="button" class="btn btn-dark" onClick={() => fetchCatalog()}>
          {t.retry}
        </button>
      </div>
    );
  }
  if (!draft || !result || catalog.products.length === 0) {
    return <p class="q-status">{t.noProducts}</p>;
  }

  const activeIndex = Math.max(0, draft.containers.findIndex((c) => c.uid === draft.activeUid));
  const update = (fn: (d: Draft) => Draft) => setDraft((d) => (d ? fn(d) : d));
  const setContainer = (uidKey: string, next: DraftContainer) =>
    update((d) => ({ ...d, containers: d.containers.map((c) => (c.uid === uidKey ? next : c)) }));

  const showToast = (msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  };

  const addPackaging = (p: CatalogPackaging) => {
    const target = draft.containers[activeIndex];
    const product = packs.get(p.id)?.product;
    if (!target || !product) return;
    const existing = target.lines.find((l) => l.packagingId === p.id);
    const next: DraftContainer = existing
      ? { ...target, lines: target.lines.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l)) }
      : {
          ...target,
          lines: [...target.lines, { uid: uid(), packagingId: p.id, quantity: 1, optionIds: defaultOptionIds(product.options) }],
        };
    setContainer(target.uid, next);
    showToast(t.added(1, locale === 'tr' ? product.nameTr : product.nameEn, activeIndex + 1));
  };

  const addContainer = () => {
    const last = draft.containers[draft.containers.length - 1];
    const c = newContainer(catalog, last?.containerTypeId);
    update((d) => ({ ...d, containers: [...d.containers, c], activeUid: c.uid }));
  };

  const reset = () => {
    if (!window.confirm(t.resetConfirm)) return;
    clearDraft();
    setDraft(emptyDraft(catalog));
  };

  const total = physicalCount(draft);
  const canAdd = total < LIMITS.maxContainers;
  const active = draft.containers[activeIndex];
  const hasErrors = (i: number) =>
    result.errors.some((e) => e.path === `containers.${i}` || e.path.startsWith(`containers.${i}.`));
  const select = (i: number) => update((d) => ({ ...d, activeUid: d.containers[i]?.uid ?? d.activeUid }));
  const detailsProduct = dialog?.kind === 'details' ? catalog.products.find((p) => p.id === dialog.productId) : undefined;

  /** Arrow keys move between tabs (WAI-ARIA tabs pattern). */
  const onTabKey = (e: KeyboardEvent) => {
    const n = draft.containers.length;
    let next = -1;
    if (e.key === 'ArrowRight') next = (activeIndex + 1) % n;
    else if (e.key === 'ArrowLeft') next = (activeIndex - 1 + n) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    if (next < 0) return;
    e.preventDefault();
    select(next);
    const id = `q-tab-${draft.containers[next].uid}`;
    window.requestAnimationFrame(() => document.getElementById(id)?.focus());
  };

  return (
    <div class="q-layout">
      <section class="q-panel q-containers" aria-labelledby="q-containers-title">
        <div class="q-containers__head">
          <div>
            <h2 id="q-containers-title" class="q-panel__title">
              {t.containers}
            </h2>
            <p class="q-hint">{t.containersHint}</p>
          </div>
          <a class="q-jump" href="#q-summary-title">
            <span class="q-jump__label">
              {t.orderTotal} · {t.containerTotalCount(total)}
            </span>
            <strong class="q-jump__value">{fmt.money(result.totalCents)}</strong>
            <span class="q-jump__link">{t.toSummary} ↓</span>
          </a>
        </div>

        <div class="q-tabs">
          <div class="q-tabs__list" role="tablist" aria-labelledby="q-containers-title" onKeyDown={onTabKey}>
            {draft.containers.map((c, i) => {
              const type = catalog.containers.find((x) => x.id === c.containerTypeId);
              const selected = i === activeIndex;
              return (
                <button
                  key={c.uid}
                  id={`q-tab-${c.uid}`}
                  type="button"
                  role="tab"
                  class={`q-tab${selected ? ' q-tab--active' : ''}${hasErrors(i) ? ' q-tab--error' : ''}`}
                  aria-selected={selected}
                  aria-controls={`q-tabpanel-${c.uid}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => select(i)}
                >
                  <span class="q-tab__title">{t.container(i + 1)}</span>
                  <span class="q-tab__meta">
                    {type?.code ?? '?'}
                    {c.count > 1 ? ` × ${c.count}` : ''} · {fmt.money(result.containers[i]?.totalCents ?? 0)}
                  </span>
                </button>
              );
            })}
          </div>
          <button type="button" class="q-btn q-tabs__add" onClick={addContainer} disabled={!canAdd}>
            {t.addContainer}
          </button>
        </div>

        {active && (
          <div
            class="q-tabpanel"
            role="tabpanel"
            id={`q-tabpanel-${active.uid}`}
            aria-labelledby={`q-tab-${active.uid}`}
          >
            <ContainerPanel
              key={active.uid}
              index={activeIndex}
              draft={active}
              result={result.containers[activeIndex]}
              catalog={catalog}
              packs={packs}
              errors={result.errors}
              warnings={result.warnings}
              onChange={(next) => setContainer(active.uid, next)}
              onRemove={() =>
                update((d) => {
                  const containers = d.containers.filter((x) => x.uid !== active.uid);
                  const nextActive = containers[Math.min(activeIndex, containers.length - 1)];
                  return { ...d, containers, activeUid: nextActive?.uid ?? null };
                })
              }
              onDuplicate={() =>
                update((d) => {
                  const copy = duplicateContainer(active);
                  const containers = [...d.containers];
                  containers.splice(activeIndex + 1, 0, copy);
                  return { ...d, containers, activeUid: copy.uid };
                })
              }
              onAddProduct={() => setDialog({ kind: 'picker' })}
              onDetails={(productId) => setDialog({ kind: 'details', productId })}
              canRemove={draft.containers.length > 1}
              canDuplicate={total + active.count <= LIMITS.maxContainers}
              maxCount={LIMITS.maxContainers - (total - active.count)}
              colorOf={colorOf}
              fmt={fmt}
              locale={locale}
            />
          </div>
        )}
      </section>

      <Summary
        catalog={catalog}
        result={result}
        orderOptionIds={draft.optionIds}
        onOrderOptions={(ids) => update((d) => ({ ...d, optionIds: ids }))}
        deliveryTermId={draft.deliveryTermId}
        onDeliveryTerm={(id) => update((d) => ({ ...d, deliveryTermId: id }))}
        onReset={reset}
        siteKey={catalog.turnstileSiteKey}
        request={toRequest(draft)}
        onCatalogStale={() => fetchCatalog(true)}
        fmt={fmt}
        locale={locale}
      />

      {dialog?.kind === 'picker' && (
        <ProductPickerDialog
          catalog={catalog}
          containerIndex={activeIndex}
          colorOf={colorOf}
          onAdd={(p) => {
            addPackaging(p);
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
          fmt={fmt}
          locale={locale}
        />
      )}
      {detailsProduct && (
        <ProductDetailsDialog product={detailsProduct} onClose={() => setDialog(null)} fmt={fmt} locale={locale} />
      )}

      <div class={`q-toast${toast ? ' q-toast--show' : ''}`} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  );
}
