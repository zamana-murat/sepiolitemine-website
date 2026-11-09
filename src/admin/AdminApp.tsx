/** Admin panel root: hash routing, session handling, shared settings context. */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { api, onSessionExpired } from './api';
import type { Settings } from './types';
import { AdminContext, Button, ErrorBox, Loading, useAsync } from './ui';
import { Containers } from './views/Containers';
import { DeliveryTerms } from './views/DeliveryTerms';
import { OrderOptions } from './views/OrderOptions';
import { ProductDetail } from './views/ProductDetail';
import { Products } from './views/Products';
import { QuoteDetail, Quotes } from './views/Quotes';
import { SettingsView } from './views/SettingsView';

const NAV = [
  { hash: '#/quotes', label: 'Teklifler' },
  { hash: '#/products', label: 'Ürünler' },
  { hash: '#/containers', label: 'Konteynerler' },
  { hash: '#/order-options', label: 'Sipariş seçenekleri' },
  { hash: '#/delivery-terms', label: 'Teslim şekilleri' },
  { hash: '#/settings', label: 'Ayarlar' },
];

function useHash() {
  const [hash, setHash] = useState(() => window.location.hash || '#/quotes');
  useEffect(() => {
    const on = () => setHash(window.location.hash || '#/quotes');
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const navigate = (h: string) => {
    if (window.location.hash === h) setHash(h);
    else window.location.hash = h;
    window.scrollTo(0, 0);
  };
  return { hash, navigate };
}

export default function AdminApp() {
  const { hash, navigate } = useHash();
  const [expired, setExpired] = useState(false);
  useEffect(() => onSessionExpired(() => setExpired(true)), []);

  const me = useAsync(() => api.get<{ email: string }>('/me'), []);
  const settings = useAsync(() => api.get<Settings>('/settings'), []);

  const ctx = useMemo(
    () => ({
      currency: settings.data?.currency ?? 'USD',
      email: me.data?.email ?? '',
      reloadSettings: settings.reload,
    }),
    [settings.data, me.data, settings.reload],
  );

  const productMatch = hash.match(/^#\/products\/(\d+)$/);
  const quoteMatch = hash.match(/^#\/quotes\/(\d+)$/);
  let view;
  if (productMatch) view = <ProductDetail id={Number(productMatch[1])} navigate={navigate} />;
  else if (quoteMatch) view = <QuoteDetail id={Number(quoteMatch[1])} navigate={navigate} />;
  else if (hash === '#/quotes') view = <Quotes navigate={navigate} />;
  else if (hash === '#/containers') view = <Containers />;
  else if (hash === '#/order-options') view = <OrderOptions />;
  else if (hash === '#/delivery-terms') view = <DeliveryTerms />;
  else if (hash === '#/settings') view = <SettingsView />;
  else view = <Products navigate={navigate} />;

  const section = productMatch ? '#/products' : quoteMatch ? '#/quotes' : hash;

  return (
    <AdminContext.Provider value={ctx}>
      <div class="adm-shell">
        <header class="adm-top">
          <div class="adm-top__brand">
            <span class="adm-top__logo">Sepiolite Mine</span>
            <span class="adm-top__tag">Teklif yönetimi</span>
          </div>
          <nav class="adm-nav" aria-label="Yönetim">
            {NAV.map((n) => (
              <a key={n.hash} href={n.hash} class={section === n.hash ? 'is-active' : ''}>
                {n.label}
              </a>
            ))}
          </nav>
          <div class="adm-top__user">
            {me.data?.email && <span>{me.data.email}</span>}
            <a href="/cdn-cgi/access/logout">Çıkış</a>
          </div>
        </header>

        <main class="adm-main">
          {expired && (
            <div class="adm-alert adm-alert--warn" role="alert">
              <strong>Oturum süresi doldu.</strong> Kaydedilmemiş değişiklikler kaybolabilir.{' '}
              <Button variant="primary" onClick={() => window.location.reload()}>
                Yeniden giriş yap
              </Button>
            </div>
          )}
          {me.loading && !me.data ? (
            <Loading />
          ) : me.error ? (
            <ErrorBox error={me.error} />
          ) : (
            view
          )}
        </main>
      </div>
    </AdminContext.Provider>
  );
}
