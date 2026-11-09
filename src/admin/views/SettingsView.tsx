import { useState } from 'preact/hooks';
import { api } from '../api';
import type { Settings } from '../types';
import { Button, Card, ErrorBox, Field, Loading, NumInput, Select, TextInput, useAction, useAdmin, useAsync, useForm } from '../ui';

function SettingsForm(props: { initial: Settings }) {
  const { reloadSettings } = useAdmin();
  const { values: v, set } = useForm<Settings>(props.initial);
  const action = useAction();
  const [saved, setSaved] = useState(false);
  return (
    <form
      class="adm-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaved(false);
        if (await action.run(() => api.put('/settings', v))) {
          setSaved(true);
          reloadSettings();
        }
      }}
    >
      <ErrorBox error={action.error} />
      <div class="adm-grid">
        <Field
          label="Para birimi"
          hint="Tüm fiyatlar bu para biriminde girilir ve teklifte bu birimle gösterilir. Değiştirmek mevcut tutarları çevirmez."
        >
          <Select
            value={v.currency}
            onChange={(x) => set('currency', x)}
            options={[
              { value: 'USD', label: 'USD (ABD doları)' },
              { value: 'EUR', label: 'EUR (Euro)' },
            ]}
          />
        </Field>
        <Field label="Teklif geçerlilik süresi" hint="Soft offer PDF'inde yazacak geçerlilik">
          <NumInput value={v.quote_validity_days} onChange={(x) => set('quote_validity_days', x ?? 30)} integer suffix="gün" />
        </Field>
        <Field label="Teklif numarası öneki" hint="Büyük harf, 1 ile 6 karakter. Örn. SM → SM-2026-0001">
          <TextInput value={v.quote_number_prefix} onChange={(x) => set('quote_number_prefix', x.toUpperCase())} required />
        </Field>
      </div>

      <h3 class="adm-subhead">Genel teklif notları</h3>
      <p class="adm-muted">
        Her soft offer PDF'inin notlar bölümünde çıkar. Teslim şekli ve ödeme koşulları artık{' '}
        <a href="#/delivery-terms">Teslim şekilleri</a> ekranında, her teslim şekli için ayrı tutulur. Değişiklik
        yalnız bundan sonra verilecek tekliflere yansır.
      </p>
      <div class="adm-grid">
        <Field label="Teklif notları (TR)" hint="Yükleme süresi, minimum sipariş gibi ek bilgiler. Bilgi notu her zaman ayrıca eklenir.">
          <TextInput value={v.offer_notes_tr} onChange={(x) => set('offer_notes_tr', x)} maxLength={2000} multiline />
        </Field>
        <Field label="Teklif notları (EN)">
          <TextInput value={v.offer_notes_en} onChange={(x) => set('offer_notes_en', x)} maxLength={2000} multiline />
        </Field>
      </div>
      <div class="adm-form__actions">
        <Button variant="primary" type="submit" busy={action.busy}>
          Ayarları kaydet
        </Button>
        {saved && <span class="adm-saved">Kaydedildi</span>}
      </div>
    </form>
  );
}

export function SettingsView() {
  const q = useAsync(() => api.get<Partial<Settings>>('/settings'), []);
  if (q.error) return <ErrorBox error={q.error} />;
  if (!q.data) return <Loading />;
  // Keys missing in D1 (new settings) get their defaults so the form always sends complete values.
  const initial: Settings = {
    currency: 'USD',
    quote_validity_days: 30,
    quote_number_prefix: 'SM',
    offer_notes_en: '',
    offer_notes_tr: '',
    ...q.data,
  };
  // Keys of the old single delivery term may still be stored; they are not sent back.
  for (const k of ['incoterm', 'incoterm_place', 'payment_terms_en', 'payment_terms_tr']) delete (initial as unknown as Record<string, unknown>)[k];
  return (
    <Card title="Genel ayarlar">
      <SettingsForm initial={initial} />
    </Card>
  );
}
