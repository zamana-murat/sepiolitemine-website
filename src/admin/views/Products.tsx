import { useState } from 'preact/hooks';
import { api } from '../api';
import type { Product } from '../types';
import { Badge, Button, Card, ErrorBox, Field, Loading, TextInput, slugify, useAction, useAsync, useForm } from '../ui';

export function Products(props: { navigate: (hash: string) => void }) {
  const list = useAsync(() => api.get<Product[]>('/products'), []);
  const [creating, setCreating] = useState(false);
  const action = useAction();
  const { values: v, set, reset } = useForm({ nameTr: '', nameEn: '', slug: '', slugTouched: false });

  const create = async () => {
    let created: Product | null = null;
    const ok = await action.run(async () => {
      created = await api.post<Product>('/products', { nameTr: v.nameTr, nameEn: v.nameEn, slug: v.slug });
    });
    if (ok && created) {
      reset({ nameTr: '', nameEn: '', slug: '', slugTouched: false });
      props.navigate(`#/products/${(created as Product).id}`);
    }
  };

  return (
    <Card
      title="Ürünler"
      actions={
        !creating && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            + Yeni ürün
          </Button>
        )
      }
    >
      {creating && (
        <form
          class="adm-form adm-form--boxed"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <ErrorBox error={action.error} />
          <div class="adm-grid">
            <Field label="Ad (TR)">
              <TextInput value={v.nameTr} onChange={(x) => set('nameTr', x)} required />
            </Field>
            <Field label="Ad (EN)">
              <TextInput
                value={v.nameEn}
                onChange={(x) => {
                  set('nameEn', x);
                  if (!v.slugTouched) set('slug', slugify(x));
                }}
                required
              />
            </Field>
            <Field label="Kısa ad (slug)" hint="Küçük harf ve tire. İngilizce addan otomatik üretilir.">
              <TextInput
                value={v.slug}
                onChange={(x) => {
                  set('slug', x);
                  set('slugTouched', true);
                }}
                required
              />
            </Field>
          </div>
          <div class="adm-form__actions">
            <Button variant="primary" type="submit" busy={action.busy}>
              Oluştur ve düzenle
            </Button>
            <Button onClick={() => setCreating(false)}>Vazgeç</Button>
          </div>
        </form>
      )}

      <ErrorBox error={list.error} />
      {list.loading && !list.data && <Loading />}
      {list.data && list.data.length === 0 && !creating && (
        <p class="adm-muted">Henüz ürün yok. "Yeni ürün" ile başlayın.</p>
      )}
      {list.data && list.data.length > 0 && (
        <table class="adm-table adm-table--click">
          <thead>
            <tr>
              <th>Ürün</th>
              <th>Slug</th>
              <th>GTİP</th>
              <th>Sıra</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {list.data.map((p) => (
              <tr
                key={p.id}
                class={p.active ? '' : 'adm-row--off'}
                tabIndex={0}
                onClick={() => props.navigate(`#/products/${p.id}`)}
                onKeyDown={(e) => e.key === 'Enter' && props.navigate(`#/products/${p.id}`)}
              >
                <td>
                  <strong>{p.nameTr}</strong>
                  <div class="adm-muted">{p.nameEn}</div>
                </td>
                <td>
                  <code>{p.slug}</code>
                </td>
                <td>{p.hsCode ?? <span class="adm-muted">-</span>}</td>
                <td>{p.sortOrder}</td>
                <td>{p.active ? <Badge tone="ok">Aktif</Badge> : <Badge tone="off">Pasif</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
