import { useState } from 'preact/hooks';
import { api } from '../api';
import { OptionsEditor } from '../OptionsEditor';
import type { ContainerType, OptionRow } from '../types';
import {
  Badge,
  Button,
  Card,
  ErrorBox,
  Field,
  Loading,
  NumInput,
  TextInput,
  formatNumber,
  payload,
  useAction,
  useAsync,
  useForm,
} from '../ui';

type Draft = Omit<ContainerType, 'id' | 'code'>;

const volumeM3 = (t: Pick<ContainerType, 'innerLengthMm' | 'innerWidthMm' | 'innerHeightMm'>) =>
  (t.innerLengthMm * t.innerWidthMm * t.innerHeightMm) / 1e9;

function ContainerCard(props: { type: ContainerType; onChanged: () => void }) {
  const t = props.type;
  const { code: _code, ...initial } = payload(t);
  const { values: v, set } = useForm<Draft>(initial);
  const action = useAction();
  const toggle = useAction();
  const [saved, setSaved] = useState(false);

  const limit = v.practicalPayloadKg ?? v.maxPayloadKg;

  return (
    <div class={`adm-container${t.enabled ? '' : ' adm-container--off'}`}>
      <header class="adm-container__head">
        <div>
          <h3>
            {t.code} <span class="adm-muted">· {t.nameTr}</span>
          </h3>
          <p class="adm-muted">
            {formatNumber(volumeM3(v), 1)} m³ iç hacim · uygulanan yük sınırı {formatNumber(limit)} kg
          </p>
        </div>
        <div class="adm-container__toggle">
          {t.enabled ? <Badge tone="ok">Müşteriye açık</Badge> : <Badge tone="off">Kapalı</Badge>}
          <Button
            variant={t.enabled ? 'ghost' : 'primary'}
            busy={toggle.busy}
            onClick={async () => {
              if (await toggle.run(() => api.put(`/containers/${t.id}`, { enabled: !t.enabled }))) props.onChanged();
            }}
          >
            {t.enabled ? 'Kapat' : 'Aç'}
          </Button>
        </div>
      </header>
      <ErrorBox error={toggle.error} />
      <form
        class="adm-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaved(false);
          const { enabled: _e, ...fields } = v; // enabled has its own button
          if (await action.run(() => api.put(`/containers/${t.id}`, fields))) {
            setSaved(true);
            props.onChanged();
          }
        }}
      >
        <ErrorBox error={action.error} />
        <div class="adm-grid">
          <Field label="Ad (TR)">
            <TextInput value={v.nameTr} onChange={(x) => set('nameTr', x)} required />
          </Field>
          <Field label="Ad (EN)">
            <TextInput value={v.nameEn} onChange={(x) => set('nameEn', x)} required />
          </Field>
          <Field label="İç uzunluk">
            <NumInput value={v.innerLengthMm} onChange={(x) => set('innerLengthMm', x ?? 0)} integer suffix="mm" />
          </Field>
          <Field label="İç genişlik">
            <NumInput value={v.innerWidthMm} onChange={(x) => set('innerWidthMm', x ?? 0)} integer suffix="mm" />
          </Field>
          <Field label="İç yükseklik">
            <NumInput value={v.innerHeightMm} onChange={(x) => set('innerHeightMm', x ?? 0)} integer suffix="mm" />
          </Field>
          <Field label="Kapı genişliği">
            <NumInput value={v.doorWidthMm} onChange={(x) => set('doorWidthMm', x ?? 0)} integer suffix="mm" />
          </Field>
          <Field label="Kapı yüksekliği">
            <NumInput value={v.doorHeightMm} onChange={(x) => set('doorHeightMm', x ?? 0)} integer suffix="mm" />
          </Field>
          <Field label="Dara">
            <NumInput value={v.tareKg} onChange={(x) => set('tareKg', x ?? 0)} integer suffix="kg" />
          </Field>
          <Field label="Teknik maks. yük" hint="ISO / üretici değeri">
            <NumInput value={v.maxPayloadKg} onChange={(x) => set('maxPayloadKg', x ?? 0)} integer suffix="kg" />
          </Field>
          <Field
            label="Pratik yük sınırı"
            hint="Karayolu ve hat kurallarına göre gerçekte uyguladığınız sınır. Boş bırakılırsa teknik maks. yük kullanılır."
          >
            <NumInput
              value={v.practicalPayloadKg}
              onChange={(x) => set('practicalPayloadKg', x)}
              integer
              nullable
              suffix="kg"
              placeholder={String(v.maxPayloadKg)}
            />
          </Field>
          <Field label="Sıra">
            <NumInput value={v.sortOrder} onChange={(x) => set('sortOrder', x ?? 0)} integer />
          </Field>
        </div>
        {v.practicalPayloadKg !== null && v.practicalPayloadKg > v.maxPayloadKg && (
          <div class="adm-alert adm-alert--warn">Pratik yük sınırı, teknik maks. yükten büyük girilmiş. Değeri kontrol edin.</div>
        )}
        <div class="adm-form__actions">
          <Button variant="primary" type="submit" busy={action.busy}>
            {t.code} ölçülerini kaydet
          </Button>
          {saved && <span class="adm-saved">Kaydedildi</span>}
        </div>
      </form>
    </div>
  );
}

export function Containers() {
  const q = useAsync(() => api.get<{ types: ContainerType[]; options: OptionRow[] }>('/containers'), []);
  if (q.error) return <ErrorBox error={q.error} />;
  if (!q.data) return <Loading />;
  const { types, options } = q.data;

  return (
    <div class="adm-stack">
      <Card title="Konteyner tipleri">
        <p class="adm-muted">
          Kapalı konteynerler müşteri ekranında görünmez. Ölçüler yükleme hesabında (taban yerleşimi, istif, ağırlık)
          doğrudan kullanılır.
        </p>
        {types.map((t) => (
          <ContainerCard key={`${t.id}-${JSON.stringify(t)}`} type={t} onChanged={q.reload} />
        ))}
      </Card>
      <Card title="Konteyner seçenekleri ve ek fiyatlar">
        <p class="adm-muted">
          Konteyner başına uygulanır. Zorunlu seçenekler sabit ek ücrettir (örn. liman / yükleme hizmeti); yüzde
          seçenekler konteynerdeki ürünlerin toplam bedeli üzerinden hesaplanır.
        </p>
        <OptionsEditor
          scope="container"
          rows={options}
          createPath="/container-options"
          itemPath={(id) => `/container-options/${id}`}
          onChanged={q.reload}
          containerTypes={types}
          emptyText="Konteyner seçeneği yok."
        />
      </Card>
    </div>
  );
}
