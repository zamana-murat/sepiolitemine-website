import { useState } from 'preact/hooks';
import { api } from '../api';
import { OptionsEditor } from '../OptionsEditor';
import type { DocType, Packaging, Product, ProductDetail as Detail, ProductDocument, ProductSpec } from '../types';
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
  formatBytes,
  formatMoney,
  formatNumber,
  payload,
  useAction,
  useAdmin,
  useAsync,
  useForm,
} from '../ui';

/* ───────────── Product info ───────────── */

type ProductDraft = Omit<Product, 'id'>;

function toProductDraft(d: Detail): ProductDraft {
  const { packagings: _p, documents: _d, options: _o, ...product } = d;
  return payload(product);
}

function SpecsEditor(props: { specs: ProductSpec[]; onChange: (s: ProductSpec[]) => void }) {
  const update = (i: number, patch: Partial<ProductSpec>) =>
    props.onChange(props.specs.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <div class="adm-specs">
      {props.specs.length > 0 && (
        <table class="adm-table adm-table--dense">
          <thead>
            <tr>
              <th>Özellik (TR)</th>
              <th>Özellik (EN)</th>
              <th>Değer</th>
              <th>Birim</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {props.specs.map((s, i) => (
              <tr key={i}>
                <td>
                  <TextInput value={s.labelTr} onChange={(x) => update(i, { labelTr: x })} required />
                </td>
                <td>
                  <TextInput value={s.labelEn} onChange={(x) => update(i, { labelEn: x })} required />
                </td>
                <td>
                  <TextInput value={s.value} onChange={(x) => update(i, { value: x })} required />
                </td>
                <td>
                  <TextInput value={s.unit ?? ''} onChange={(x) => update(i, { unit: x || undefined })} />
                </td>
                <td>
                  <Button variant="danger" onClick={() => props.onChange(props.specs.filter((_, j) => j !== i))}>
                    Kaldır
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Button onClick={() => props.onChange([...props.specs, { labelTr: '', labelEn: '', value: '' }])}>
        + Özellik satırı
      </Button>
    </div>
  );
}

function ProductInfo(props: { detail: Detail; onSaved: () => void }) {
  const { values: v, set } = useForm<ProductDraft>(toProductDraft(props.detail));
  const action = useAction();
  const [saved, setSaved] = useState(false);

  return (
    <form
      class="adm-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaved(false);
        if (await action.run(() => api.put(`/products/${props.detail.id}`, v))) {
          setSaved(true);
          props.onSaved();
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
        <Field label="Slug" hint="Değiştirirseniz eski bağlantılar çalışmaz.">
          <TextInput value={v.slug} onChange={(x) => set('slug', x)} required />
        </Field>
        <Field label="GTİP / HS kodu">
          <TextInput value={v.hsCode} onChange={(x) => set('hsCode', x.trim() === '' ? null : x)} />
        </Field>
        <Field label="Açıklama (TR)" wide>
          <TextInput value={v.descriptionTr} onChange={(x) => set('descriptionTr', x)} multiline />
        </Field>
        <Field label="Açıklama (EN)" wide>
          <TextInput value={v.descriptionEn} onChange={(x) => set('descriptionEn', x)} multiline />
        </Field>
        <Field label="Sıra">
          <NumInput value={v.sortOrder} onChange={(x) => set('sortOrder', x ?? 0)} integer />
        </Field>
      </div>
      <h3 class="adm-subhead">Teknik özellikler</h3>
      <SpecsEditor specs={v.specs} onChange={(s) => set('specs', s)} />
      <div class="adm-toggles">
        <Toggle checked={v.active} onChange={(x) => set('active', x)} label="Aktif: müşteri ekranında görünür" />
      </div>
      <div class="adm-form__actions">
        <Button variant="primary" type="submit" busy={action.busy}>
          Ürün bilgilerini kaydet
        </Button>
        {saved && <span class="adm-saved">Kaydedildi</span>}
      </div>
    </form>
  );
}

/* ───────────── Packagings ───────────── */

type PackagingDraft = Omit<Packaging, 'id' | 'productId'>;

const PRESETS: { label: string; patch: Partial<PackagingDraft> }[] = [
  { label: 'Bigbag 90×90×110', patch: { type: 'bigbag', lengthMm: 900, widthMm: 900, heightMm: 1100 } },
  { label: 'Euro palet 120×80', patch: { type: 'pallet', lengthMm: 1200, widthMm: 800 } },
  { label: 'Standart palet 120×100', patch: { type: 'pallet', lengthMm: 1200, widthMm: 1000 } },
];

const emptyPackaging = (): PackagingDraft => ({
  type: 'bigbag',
  nameTr: '',
  nameEn: '',
  netWeightKg: 1000,
  grossWeightKg: 1005,
  lengthMm: 900,
  widthMm: 900,
  heightMm: 1100,
  maxTiers: 1,
  allowRotation: true,
  priceBasis: 'per_ton',
  priceCents: 0,
  active: true,
  sortOrder: 0,
});

function PackagingForm(props: {
  initial: PackagingDraft;
  onSave: (d: PackagingDraft) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const { currency } = useAdmin();
  const { values: v, set, reset } = useForm<PackagingDraft>(props.initial);
  return (
    <form
      class="adm-form adm-form--boxed"
      onSubmit={(e) => {
        e.preventDefault();
        props.onSave(v);
      }}
    >
      <div class="adm-presets">
        <span class="adm-muted">Hazır ölçü:</span>
        {PRESETS.map((p) => (
          <Button key={p.label} onClick={() => reset({ ...v, ...p.patch })}>
            {p.label}
          </Button>
        ))}
      </div>
      <div class="adm-grid">
        <Field label="Tip">
          <Select
            value={v.type}
            onChange={(x) => set('type', x)}
            options={[
              { value: 'bigbag', label: 'Bigbag' },
              { value: 'pallet', label: 'Palet' },
            ]}
          />
        </Field>
        <Field label="Ad (TR)" hint="Müşterinin göreceği ad, örn. 1000 kg Bigbag">
          <TextInput value={v.nameTr} onChange={(x) => set('nameTr', x)} required />
        </Field>
        <Field label="Ad (EN)">
          <TextInput value={v.nameEn} onChange={(x) => set('nameEn', x)} required />
        </Field>
        <Field label="Net ağırlık" hint="Ambalaj başına ürün ağırlığı">
          <NumInput value={v.netWeightKg} onChange={(x) => set('netWeightKg', x ?? 0)} suffix="kg" />
        </Field>
        <Field label="Brüt ağırlık" hint="Ürün + ambalaj (+ palet). Konteyner yük sınırı bununla hesaplanır.">
          <NumInput value={v.grossWeightKg} onChange={(x) => set('grossWeightKg', x ?? 0)} suffix="kg" />
        </Field>
        <Field label="Uzunluk">
          <NumInput value={v.lengthMm} onChange={(x) => set('lengthMm', x ?? 0)} integer suffix="mm" />
        </Field>
        <Field label="Genişlik">
          <NumInput value={v.widthMm} onChange={(x) => set('widthMm', x ?? 0)} integer suffix="mm" />
        </Field>
        <Field label="Yükseklik" hint="Paletlerde palet dahil toplam yükseklik">
          <NumInput value={v.heightMm} onChange={(x) => set('heightMm', x ?? 0)} integer suffix="mm" />
        </Field>
        <Field label="İstif katı" hint="Üst üste en fazla kaç adet konabilir (1 = istif yok)">
          <NumInput value={v.maxTiers} onChange={(x) => set('maxTiers', x ?? 1)} integer />
        </Field>
        <Field label="Fiyat esası">
          <Select
            value={v.priceBasis}
            onChange={(x) => set('priceBasis', x)}
            options={[
              { value: 'per_ton', label: 'Ton başına (net)' },
              { value: 'per_unit', label: 'Ambalaj birimi başına' },
            ]}
          />
        </Field>
        <Field label="Fiyat" hint={v.priceBasis === 'per_ton' ? `${currency} / ton net ürün` : `${currency} / adet`}>
          <NumInput value={v.priceCents} onChange={(x) => set('priceCents', x ?? 0)} divisor={100} integer suffix={currency} />
        </Field>
        <Field label="Sıra">
          <NumInput value={v.sortOrder} onChange={(x) => set('sortOrder', x ?? 0)} integer />
        </Field>
      </div>
      <div class="adm-toggles">
        <Toggle checked={v.allowRotation} onChange={(x) => set('allowRotation', x)} label="Konteyner tabanında 90° döndürülebilir" />
        <Toggle checked={v.active} onChange={(x) => set('active', x)} label="Aktif" />
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

function Packagings(props: { productId: number; rows: Packaging[]; onChanged: () => void }) {
  const { currency } = useAdmin();
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const action = useAction();
  const edit = (x: number | 'new' | null) => {
    action.clear();
    setEditing(x);
  };

  const save = async (d: PackagingDraft) => {
    const ok = await action.run(() =>
      editing === 'new'
        ? api.post(`/products/${props.productId}/packagings`, d)
        : api.put(`/packagings/${editing}`, d),
    );
    if (ok) {
      edit(null);
      props.onChanged();
    }
  };

  const remove = async (p: Packaging) => {
    if (!confirm(`"${p.nameTr}" ambalajı silinsin mi?`)) return;
    if (await action.run(() => api.del(`/packagings/${p.id}`))) props.onChanged();
  };

  return (
    <div>
      <ErrorBox error={action.error} />
      {props.rows.length === 0 && editing !== 'new' && (
        <p class="adm-muted">
          Ambalaj yok. Aktif ambalajı olmayan ürün müşteri ekranında görünmez.
        </p>
      )}
      {props.rows.length > 0 && (
        <table class="adm-table">
          <thead>
            <tr>
              <th>Ambalaj</th>
              <th>Net / brüt</th>
              <th>Ölçü (mm)</th>
              <th>İstif</th>
              <th>Fiyat</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {props.rows.map((p) =>
              editing === p.id ? (
                <tr key={p.id}>
                  <td colSpan={6}>
                    <PackagingForm initial={payload(p)} onSave={save} onCancel={() => edit(null)} busy={action.busy} />
                  </td>
                </tr>
              ) : (
                <tr key={p.id} class={p.active ? '' : 'adm-row--off'}>
                  <td>
                    <Badge>{p.type === 'bigbag' ? 'Bigbag' : 'Palet'}</Badge> <strong>{p.nameTr}</strong>
                    <div class="adm-muted">{p.nameEn}</div>
                  </td>
                  <td class="adm-nowrap">
                    {formatNumber(p.netWeightKg, 1)} / {formatNumber(p.grossWeightKg, 1)} kg
                  </td>
                  <td class="adm-nowrap">
                    {p.lengthMm} × {p.widthMm} × {p.heightMm}
                    {p.allowRotation && <div class="adm-muted">döndürülebilir</div>}
                  </td>
                  <td>{p.maxTiers === 1 ? 'Yok' : `${p.maxTiers} kat`}</td>
                  <td class="adm-nowrap">
                    {formatMoney(p.priceCents, currency)} / {p.priceBasis === 'per_ton' ? 'ton' : 'adet'}
                    {p.priceBasis === 'per_unit' && p.netWeightKg > 0 && (
                      <div class="adm-muted">
                        ≈ {formatMoney(Math.round(p.priceCents / (p.netWeightKg / 1000)), currency)} / ton
                      </div>
                    )}
                  </td>
                  <td class="adm-row-actions">
                    <Button onClick={() => edit(p.id)} disabled={editing !== null}>
                      Düzenle
                    </Button>
                    <Button variant="danger" onClick={() => void remove(p)} disabled={editing !== null}>
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
        <PackagingForm initial={emptyPackaging()} onSave={save} onCancel={() => edit(null)} busy={action.busy} />
      ) : (
        <div class="adm-form__actions">
          <Button variant="primary" onClick={() => edit('new')} disabled={editing !== null}>
            + Ambalaj ekle
          </Button>
        </div>
      )}
    </div>
  );
}

/* ───────────── Documents ───────────── */

const DOC_TYPES: { value: DocType; label: string }[] = [
  { value: 'tds', label: 'Teknik veri föyü (TDS)' },
  { value: 'msds', label: 'Güvenlik bilgi formu (SDS / MSDS)' },
  { value: 'coa', label: 'Analiz sertifikası (CoA)' },
  { value: 'certificate', label: 'Sertifika' },
  { value: 'other', label: 'Diğer' },
];
const docTypeLabel = (t: DocType) => DOC_TYPES.find((d) => d.value === t)?.label ?? t;

type DocMeta = Pick<ProductDocument, 'docType' | 'titleEn' | 'titleTr' | 'isPublic' | 'sortOrder'>;

function DocMetaFields(props: { v: DocMeta; set: <K extends keyof DocMeta>(k: K, val: DocMeta[K]) => void }) {
  const { v, set } = props;
  return (
    <>
      <div class="adm-grid">
        <Field label="Belge tipi">
          <Select value={v.docType} onChange={(x) => set('docType', x)} options={DOC_TYPES} />
        </Field>
        <Field label="Başlık (TR)">
          <TextInput value={v.titleTr} onChange={(x) => set('titleTr', x)} required />
        </Field>
        <Field label="Başlık (EN)">
          <TextInput value={v.titleEn} onChange={(x) => set('titleEn', x)} required />
        </Field>
        <Field label="Sıra">
          <NumInput value={v.sortOrder} onChange={(x) => set('sortOrder', x ?? 0)} integer />
        </Field>
      </div>
      <div class="adm-toggles">
        <Toggle
          checked={v.isPublic}
          onChange={(x) => set('isPublic', x)}
          label="Herkese açık: müşteri ekranında indirilebilir"
        />
      </div>
    </>
  );
}

function DocumentEdit(props: { doc: ProductDocument; onDone: (changed: boolean) => void }) {
  const { values: v, set } = useForm<DocMeta>({
    docType: props.doc.docType,
    titleEn: props.doc.titleEn,
    titleTr: props.doc.titleTr,
    isPublic: props.doc.isPublic,
    sortOrder: props.doc.sortOrder,
  });
  const action = useAction();
  return (
    <form
      class="adm-form adm-form--boxed"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await action.run(() => api.put(`/documents/${props.doc.id}`, v))) props.onDone(true);
      }}
    >
      <ErrorBox error={action.error} />
      <DocMetaFields v={v} set={set} />
      <div class="adm-form__actions">
        <Button variant="primary" type="submit" busy={action.busy}>
          Kaydet
        </Button>
        <Button onClick={() => props.onDone(false)}>Vazgeç</Button>
      </div>
    </form>
  );
}

function DocumentUpload(props: { productId: number; onDone: (changed: boolean) => void }) {
  const { values: v, set } = useForm<DocMeta>({ docType: 'tds', titleEn: '', titleTr: '', isPublic: true, sortOrder: 0 });
  const [file, setFile] = useState<File | null>(null);
  const action = useAction();
  return (
    <form
      class="adm-form adm-form--boxed"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!file) return;
        const fd = new FormData();
        fd.set('file', file);
        fd.set('docType', v.docType);
        fd.set('titleEn', v.titleEn);
        fd.set('titleTr', v.titleTr);
        fd.set('isPublic', String(v.isPublic));
        fd.set('sortOrder', String(v.sortOrder));
        if (await action.run(() => api.post(`/products/${props.productId}/documents`, fd))) props.onDone(true);
      }}
    >
      <ErrorBox error={action.error} />
      <Field label="Dosya" hint="PDF, PNG, JPEG veya WebP · en fazla 20 MB">
        <input
          class="adm-input"
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          required
          onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)}
        />
      </Field>
      <DocMetaFields v={v} set={set} />
      <div class="adm-form__actions">
        <Button variant="primary" type="submit" busy={action.busy} disabled={!file}>
          Yükle
        </Button>
        <Button onClick={() => props.onDone(false)}>Vazgeç</Button>
      </div>
    </form>
  );
}

function Documents(props: { productId: number; rows: ProductDocument[]; onChanged: () => void }) {
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const action = useAction();
  const edit = (x: number | 'new' | null) => {
    action.clear();
    setEditing(x);
  };
  const done = (changed: boolean) => {
    edit(null);
    if (changed) props.onChanged();
  };
  const remove = async (d: ProductDocument) => {
    if (!confirm(`"${d.titleTr}" belgesi ve dosyası silinsin mi?`)) return;
    if (await action.run(() => api.del(`/documents/${d.id}`))) props.onChanged();
  };

  return (
    <div>
      <ErrorBox error={action.error} />
      {props.rows.length === 0 && editing !== 'new' && <p class="adm-muted">Belge yok.</p>}
      {props.rows.length > 0 && (
        <table class="adm-table">
          <thead>
            <tr>
              <th>Belge</th>
              <th>Tip</th>
              <th>Dosya</th>
              <th>Erişim</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {props.rows.map((d) =>
              editing === d.id ? (
                <tr key={d.id}>
                  <td colSpan={5}>
                    <DocumentEdit doc={d} onDone={done} />
                  </td>
                </tr>
              ) : (
                <tr key={d.id}>
                  <td>
                    <strong>{d.titleTr}</strong>
                    <div class="adm-muted">{d.titleEn}</div>
                  </td>
                  <td>{docTypeLabel(d.docType)}</td>
                  <td>
                    <a href={`/api/admin/documents/${d.id}/file`} target="_blank" rel="noopener">
                      {d.fileName}
                    </a>
                    <div class="adm-muted">{formatBytes(d.sizeBytes)}</div>
                  </td>
                  <td>{d.isPublic ? <Badge tone="ok">Açık</Badge> : <Badge tone="off">Yalnız admin</Badge>}</td>
                  <td class="adm-row-actions">
                    <Button onClick={() => edit(d.id)} disabled={editing !== null}>
                      Düzenle
                    </Button>
                    <Button variant="danger" onClick={() => void remove(d)} disabled={editing !== null}>
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
        <DocumentUpload productId={props.productId} onDone={done} />
      ) : (
        <div class="adm-form__actions">
          <Button variant="primary" onClick={() => edit('new')} disabled={editing !== null}>
            + Belge yükle
          </Button>
        </div>
      )}
    </div>
  );
}

/* ───────────── Page ───────────── */

export function ProductDetail(props: { id: number; navigate: (hash: string) => void }) {
  const q = useAsync(() => api.get<Detail>(`/products/${props.id}`), [props.id]);
  const action = useAction();

  if (q.error) return <ErrorBox error={q.error} />;
  if (!q.data) return <Loading />;
  const d = q.data;

  const removeProduct = async () => {
    if (
      !confirm(
        `"${d.nameTr}" ürünü; ambalajları, seçenekleri ve ${d.documents.length} belgesiyle birlikte kalıcı olarak silinsin mi?`,
      )
    )
      return;
    if (await action.run(() => api.del(`/products/${d.id}`))) props.navigate('#/products');
  };

  return (
    <div class="adm-stack">
      <p>
        <a href="#/products">← Ürünler</a>
      </p>
      <Card title={d.nameTr} actions={d.active ? <Badge tone="ok">Aktif</Badge> : <Badge tone="off">Pasif</Badge>}>
        {/* key: remount the form with fresh values after a reload */}
        <ProductInfo key={JSON.stringify(toProductDraft(d))} detail={d} onSaved={q.reload} />
      </Card>
      <Card title="Ambalajlar (bigbag / palet)">
        <Packagings productId={d.id} rows={d.packagings} onChanged={q.reload} />
      </Card>
      <Card title="Ürün seçenekleri ve ek fiyatlar">
        <OptionsEditor
          scope="product"
          rows={d.options}
          createPath={`/products/${d.id}/options`}
          itemPath={(id) => `/product-options/${id}`}
          onChanged={q.reload}
          emptyText="Bu ürüne ait ek seçenek yok."
        />
      </Card>
      <Card title="Belgeler">
        <Documents productId={d.id} rows={d.documents} onChanged={q.reload} />
      </Card>
      <Card title="Tehlikeli bölge">
        <ErrorBox error={action.error} />
        <p class="adm-muted">Ürünü pasife almak, silmekten daha güvenlidir: geçmiş teklifler etkilenmez.</p>
        <Button variant="danger" onClick={() => void removeProduct()} busy={action.busy}>
          Ürünü kalıcı olarak sil
        </Button>
      </Card>
    </div>
  );
}
