import { api } from '../api';
import { OptionsEditor } from '../OptionsEditor';
import type { OptionRow } from '../types';
import { Card, ErrorBox, Loading, useAsync } from '../ui';

export function OrderOptions() {
  const q = useAsync(() => api.get<OptionRow[]>('/order-options'), []);
  if (q.error) return <ErrorBox error={q.error} />;
  if (!q.data) return <Loading />;
  return (
    <Card title="Sipariş seçenekleri ve ek fiyatlar">
      <p class="adm-muted">
        Siparişin tamamına bir kez uygulanır. Zorunlu seçenekler sabit ek ücrettir (örn. evrak ücreti); "Konteyner
        başına" seçenekler siparişteki konteyner sayısıyla çarpılır; yüzde seçenekler tüm konteynerlerin toplam bedeli
        üzerinden hesaplanır.
      </p>
      <OptionsEditor
        scope="order"
        rows={q.data}
        createPath="/order-options"
        itemPath={(id) => `/order-options/${id}`}
        onChanged={q.reload}
        emptyText="Sipariş seçeneği yok."
      />
    </Card>
  );
}
