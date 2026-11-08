import { useState } from 'preact/hooks';
import { api } from '../api';
import { INCOTERMS, type Settings } from '../types';
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

      <h3 class="adm-subhead">Soft offer koşulları</h3>
      <p class="adm-muted">
        PDF'teki “Koşullar” kutusunda ve notlarda görünür. Fiyatlar burada seçilen teslim şekline göre girilmiş
        sayılır. Değişiklik yalnız bundan sonra verilecek tekliflere yansır; verilmiş teklifler aynı kalır.
      </p>
      <div class="adm-grid">
        <Field label="Teslim şekli (Incoterm)" hint="Fiyatların hangi teslim şekline göre olduğu">
          <Select value={v.incoterm} onChange={(x) => set('incoterm', x)} options={INCOTERMS.map((i) => ({ value: i, label: i }))} />
        </Field>
        <Field label="Teslim yeri" hint="Örn. Mersin Port, Türkiye. Boş bırakılabilir.">
          <TextInput value={v.incoterm_place} onChange={(x) => set('incoterm_place', x)} maxLength={120} />
        </Field>
        <Field label="Ödeme koşulları (TR)" hint="Örn. %30 peşin (T/T), %70 konşimento kopyası karşılığı. Boşsa PDF'te satır çıkmaz.">
          <TextInput value={v.payment_terms_tr} onChange={(x) => set('payment_terms_tr', x)} maxLength={500} multiline />
        </Field>
        <Field label="Ödeme koşulları (EN)" hint="Örn. 30% advance by T/T, 70% against copy of B/L.">
          <TextInput value={v.payment_terms_en} onChange={(x) => set('payment_terms_en', x)} maxLength={500} multiline />
        </Field>
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
    incoterm: 'FOB',
    incoterm_place: '',
    payment_terms_en: '',
    payment_terms_tr: '',
    offer_notes_en: '',
    offer_notes_tr: '',
    ...q.data,
  };
  return (
    <Card title="Genel ayarlar">
      <SettingsForm initial={initial} />
    </Card>
  );
}
