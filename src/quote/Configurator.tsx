/**
 * Container quote configurator (public island on /quote/ and /tr/quote/).
 * Catalog comes from /api/quote/catalog; prices and loading are computed in the browser
 * with the same engine the server will use to issue the offer.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { LIMITS, computeQuote } from '../lib/quote/pricing';
import type { CatalogPackaging, CatalogResponse } from '../lib/quote/types';
import { ContainerCard } from './ContainerCard';
import { STRINGS, formatters, type Locale } from './i18n';
import { ProductPicker } from './ProductPicker';
import {
  clearDraft,
  defaultOptionIds,
  duplicateContainer,
  emptyDraft,
  loadDraft,
  newContainer,
  packagingIndex,
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

export default function Configurator(props: { locale: Locale }) {
  const { locale } = props;
  const t = STRINGS[locale];
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toast, setToast] = useState<string | null>(null);
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

  const canAdd = draft.containers.length < LIMITS.maxContainers;

  return (
    <div class="q-layout">
      <ProductPicker
        catalog={catalog}
        colorOf={colorOf}
        activeIndex={activeIndex}
        onAdd={addPackaging}
        fmt={fmt}
        locale={locale}
      />

      <section class="q-containers" aria-labelledby="q-containers-title">
        <h2 id="q-containers-title" class="q-panel__title q-panel__title--bare">
          {t.containers}
        </h2>
        {draft.containers.map((c, i) => (
          <ContainerCard
            key={c.uid}
            index={i}
            draft={c}
            result={result.containers[i]}
            catalog={catalog}
            packs={packs}
            active={i === activeIndex}
            errors={result.errors}
            warnings={result.warnings}
            onChange={(next) => setContainer(c.uid, next)}
            onRemove={() =>
              update((d) => {
                const containers = d.containers.filter((x) => x.uid !== c.uid);
                return { ...d, containers, activeUid: d.activeUid === c.uid ? (containers[0]?.uid ?? null) : d.activeUid };
              })
            }
            onDuplicate={() =>
              update((d) => {
                const copy = duplicateContainer(c);
                const containers = [...d.containers];
                containers.splice(i + 1, 0, copy);
                return { ...d, containers, activeUid: copy.uid };
              })
            }
            onActivate={() => update((d) => ({ ...d, activeUid: c.uid }))}
            canRemove={draft.containers.length > 1}
            canDuplicate={canAdd}
            colorOf={colorOf}
            fmt={fmt}
            locale={locale}
          />
        ))}
        <button type="button" class="btn btn-outline-dark q-add-container" onClick={addContainer} disabled={!canAdd}>
          {t.addContainer}
        </button>
      </section>

      <Summary
        catalog={catalog}
        result={result}
        orderOptionIds={draft.optionIds}
        onOrderOptions={(ids) => update((d) => ({ ...d, optionIds: ids }))}
        onReset={reset}
        siteKey={catalog.turnstileSiteKey}
        request={toRequest(draft)}
        onCatalogStale={() => fetchCatalog(true)}
        fmt={fmt}
        locale={locale}
      />

      <div class={`q-toast${toast ? ' q-toast--show' : ''}`} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  );
}
