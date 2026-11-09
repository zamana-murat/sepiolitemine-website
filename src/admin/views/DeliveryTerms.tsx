/**
 * Delivery terms (Incoterm + place), e.g. FOB Mersin, FOB İzmir. Each has its own payment terms,
 * notes and an optional price adjustment; the customer chooses one in the configurator.
 */
import { useState } from 'preact/hooks';
import { api } from '../api';
import { INCOTERMS, type DeliveryPriceType, type DeliveryTerm } from '../types';
import {
  Badge,
  Button,
  Card,
  ErrorBox,
  Field,
  Loading,
  NumInput,
  Select,
  TextInput,
  Toggle,
  formatOptionPrice,
  payload,
  useAction,
  useAdmin,
  useAsync,
  useForm,
} from '../ui';

type Draft = Omit<DeliveryTerm, 'id'>;

const PRICE_TYPES: { value: DeliveryPriceType; label: string }[] = [
  { value: 'fixed', label: 'Sipariş başına sabit' },
  { value: 'per_container', label: 'Konteyner başına' },
  { value: 'per_ton', label: 'Ton başına' },
  { value: 'percent', label: 'Yüzde (konteynerlerin toplam bedeli üzerinden)' },
];

/** Short explanations shown next to the Incoterm choice (Incoterms® 2020). */
const INCOTERM_HINTS: Record<string, string> = {
  EXW: 'Alıcı malı satıcının tesisinden alır',
  FCA: 'Belirtilen yerde alıcının taşıyıcısına teslim',
  FAS: 'Gemi yanında, yükleme limanında teslim',
  FOB: 'Gemiye yüklenmiş, yükleme limanında teslim',
  CFR: 'Navlun satıcıda, varış limanına kadar',
  CIF: 'Navlun ve sigorta satıcıda, varış limanına kadar',
  CPT: 'Taşıma bedeli satıcıda, varış yerine kadar',
  CIP: 'Taşıma ve sigorta satıcıda, varış yerine kadar',
  DAP: 'Varış yerinde, boşaltılmadan teslim',
  DPU: 'Varış yerinde, boşaltılmış olarak teslim',
  DDP: 'Gümrük vergileri ödenmiş, varış yerinde teslim',
};

const emptyDraft = (): Draft => ({
  incoterm: 'FOB',
  placeEn: '',
  placeTr: '',
  paymentTermsEn: '',
  paymentTermsTr: '',
  notesEn: '',
  notesTr: '',
  priceType: 'fixed',
  amount: 0,
  active: true,
  sortOrder: 0,
});

const label = (d: Pick<DeliveryTerm, 'incoterm' | 'placeTr'>) => `${d.incoterm} ${d.placeTr}`.trim();

function TermForm(props: { initial: Draft; onSave: (d: Draft) => Promise<boolean>; onCancel: () => void; busy: boolean }) {
  const { currency } = useAdmin();
  const { values: v, set } = useForm<Draft>(props.initial);
  const isPercent = v.priceType === 'percent';
  return (
    <form
      class="adm-form"
      onSubmit={(e) => {
        e.preventDefault();
        void props.onSave(v);
      }}
    >
      <div class="adm-grid">
        <Field label="Teslim şekli (Incoterm)" hint={INCOTERM_HINTS[v.incoterm]}>
          <Select value={v.incoterm} onChange={(x) => set('incoterm', x)} options={INCOTERMS.map((i) => ({ value: i, label: i }))} />
        </Field>
        <Field label="Sıra" hint="Küçük sayı önce gelir; ilk sıradaki müşteride seçili gelir.">
          <NumInput value={v.sortOrder} onChange={(x) => set('sortOrder', x ?? 0)} integer />
        </Field>
        <Field label="Teslim yeri (TR)" hint="Örn. Mersin Limanı, İzmir Limanı. Müşteri “FOB Mersin Limanı” olarak görür.">
          <TextInput value={v.placeTr} onChange={(x) => set('placeTr', x)} required maxLength={120} />
        </Field>
        <Field label="Teslim yeri (EN)" hint="Örn. Mersin Port, Izmir Port">
          <TextInput value={v.placeEn} onChange={(x) => set('placeEn', x)} required maxLength={120} />
        </Field>
        <Field label="Ödeme koşulları (TR)" hint="Örn. %30 peşin (T/T), %70 konşimento kopyası karşılığı. Boşsa PDF'te satır çıkmaz.">
          <TextInput value={v.paymentTermsTr} onChange={(x) => set('paymentTermsTr', x)} maxLength={500} multiline />
        </Field>
        <Field label="Ödeme koşulları (EN)" hint="Örn. 30% advance by T/T, 70% against copy of B/L.">
          <TextInput value={v.paymentTermsEn} onChange={(x) => set('paymentTermsEn', x)} maxLength={500} multiline />
        </Field>
        <Field label="Bu teslim şekline özel not (TR)" hint="Örn. yükleme süresi. Ayarlar'daki genel notlardan önce yazılır.">
          <TextInput value={v.notesTr} onChange={(x) => set('notesTr', x)} maxLength={2000} multiline />
        </Field>
        <Field label="Bu teslim şekline özel not (EN)">
          <TextInput value={v.notesEn} onChange={(x) => set('notesEn', x)} maxLength={2000} multiline />
        </Field>
        <Field
          label="Fiyat farkı türü"
          hint="Ürün fiyatları bu teslim şekline göre girildiyse farkı 0 bırakın. Örn. İzmir çıkışı için konteyner başına ek navlun."
        >
          <Select value={v.priceType} onChange={(x) => set('priceType', x)} options={PRICE_TYPES} />
        </Field>
        <Field label={isPercent ? 'Oran' : 'Tutar'} hint={`${isPercent ? 'Yüzde' : currency}. İndirim için eksi değer girin; 0 = fark yok.`}>
          <NumInput value={v.amount} onChange={(x) => set('amount', x ?? 0)} divisor={100} integer suffix={isPercent ? '%' : currency} />
        </Field>
      </div>
      <div class="adm-toggles">
        <Toggle checked={v.active} onChange={(x) => set('active', x)} label="Aktif: müşteri ekranında seçilebilir" />
      </div>
      <div class="adm-form__actions">
        <Button variant="primary" type="submit" busy={props.busy}>
          Kaydet
        </Button>
        <Button onClick={props.onCancel}>Vazgeç</Button>
      </div>
    </form>
  );
}

export function DeliveryTerms() {
  const { currency } = useAdmin();
  const q = useAsync(() => api.get<DeliveryTerm[]>('/delivery-terms'), []);
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const action = useAction();
  const edit = (x: number | 'new' | null) => {
    action.clear();
    setEditing(x);
  };

  if (q.error) return <ErrorBox error={q.error} />;
  if (!q.data) return <Loading />;
  const rows = q.data;

  const save = async (draft: Draft) => {
    const ok = await action.run(() =>
      editing === 'new' ? api.post('/delivery-terms', draft) : api.put(`/delivery-terms/${editing as number}`, draft),
    );
    if (ok) {
      edit(null);
      q.reload();
    }
    return ok;
  };

  const remove = async (row: DeliveryTerm) => {
    if (!confirm(`"${label(row)}" teslim şekli silinsin mi? Verilmiş teklifler etkilenmez.`)) return;
    if (await action.run(() => api.del(`/delivery-terms/${row.id}`))) q.reload();
  };

  const activeCount = rows.filter((r) => r.active).length;

  return (
    <Card title="Teslim şekilleri ve ödeme koşulları">
      <p class="adm-muted">
        Müşteri teklif ekranında yalnız burada açtığınız teslim şekillerinden birini seçer (örn. FOB Mersin, FOB İzmir).
        Her birinin kendi ödeme koşulu, notu ve isteğe bağlı fiyat farkı vardır. Değişiklik yalnız bundan sonraki
        tekliflere yansır.
      </p>
      {activeCount === 0 && (
        <div class="adm-alert adm-alert--warn" role="status">
          Aktif teslim şekli yok: teklifte teslim şekli ve ödeme koşulu satırı çıkmaz.
        </div>
      )}
      <ErrorBox error={action.error} />
      {rows.length > 0 && (
        <table class="adm-table">
          <thead>
            <tr>
              <th>Teslim şekli</th>
              <th>Ödeme koşulları</th>
              <th>Fiyat farkı</th>
              <th>Durum</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) =>
              editing === row.id ? (
                <tr key={row.id}>
                  <td colSpan={5}>
                    <TermForm initial={payload(row)} onSave={save} onCancel={() => edit(null)} busy={action.busy} />
                  </td>
                </tr>
              ) : (
                <tr key={row.id} class={row.active ? '' : 'adm-row--off'}>
                  <td>
                    <strong>{label(row)}</strong>
                    <div class="adm-muted">
                      {row.incoterm} {row.placeEn}
                    </div>
                  </td>
                  <td>{row.paymentTermsTr || <span class="adm-muted">Yok</span>}</td>
                  <td class="adm-nowrap">
                    {row.amount === 0 ? (
                      <span class="adm-muted">Yok</span>
                    ) : (
                      formatOptionPrice(row.priceType, row.amount, currency)
                    )}
                  </td>
                  <td>{row.active ? <Badge tone="ok">Aktif</Badge> : <Badge tone="off">Pasif</Badge>}</td>
                  <td class="adm-row-actions">
                    <Button onClick={() => edit(row.id)} disabled={editing !== null}>
                      Düzenle
                    </Button>
                    <Button variant="danger" onClick={() => void remove(row)} disabled={editing !== null}>
                      Sil
                    </Button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      )}
      {editing === 'new' ? (
        <TermForm initial={emptyDraft()} onSave={save} onCancel={() => edit(null)} busy={action.busy} />
      ) : (
        <div class="adm-form__actions">
          <Button variant="primary" onClick={() => edit('new')} disabled={editing !== null}>
            + Teslim şekli ekle
          </Button>
        </div>
      )}
    </Card>
  );
}
