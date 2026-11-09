/**
 * Generic editor for product / container / order options (same row shape on the server).
 * Mandatory option = always-applied surcharge; groupName = mutually exclusive choice.
 */
import { useState } from 'preact/hooks';
import { api } from './api';
import type { ContainerType, OptionRow, PriceType } from './types';
import {
  Badge,
  Button,
  ErrorBox,
  Field,
  NumInput,
  PRICE_TYPE_LABELS,
  Select,
  TextInput,
  Toggle,
  formatOptionPrice,
  payload,
  useAction,
  useAdmin,
  useForm,
} from './ui';

export type OptionScope = 'product' | 'container' | 'order';

/** Mirrors PRICE_TYPES_BY_SCOPE in server/validation.ts. */
const PRICE_TYPES: Record<OptionScope, PriceType[]> = {
  product: ['per_ton', 'per_unit', 'fixed', 'percent'],
  container: ['fixed', 'per_ton', 'percent'],
  order: ['fixed', 'per_container', 'per_ton', 'percent'],
};

const FIXED_LABEL: Record<OptionScope, string> = {
  product: 'Satır başına sabit',
  container: 'Konteyner başına sabit',
  order: 'Sipariş başına sabit',
};

const PERCENT_BASE: Record<OptionScope, string> = {
  product: 'bu ürün satırının mal bedeli',
  container: 'konteynerdeki ürünlerin toplam bedeli',
  order: 'tüm konteynerlerin toplam bedeli',
};

type Draft = Omit<OptionRow, 'id'>;

const emptyDraft = (scope: OptionScope): Draft => ({
  nameEn: '',
  nameTr: '',
  descriptionEn: '',
  descriptionTr: '',
  longDescriptionEn: '',
  longDescriptionTr: '',
  groupName: null,
  priceType: PRICE_TYPES[scope][0],
  amount: 0,
  isMandatory: false,
  isDefault: false,
  active: true,
  sortOrder: 0,
  ...(scope === 'container' ? { containerTypeId: null } : {}),
});

function OptionForm(props: {
  scope: OptionScope;
  initial: Draft;
  containerTypes?: ContainerType[];
  onSave: (d: Draft) => Promise<boolean>;
  onCancel: () => void;
  busy: boolean;
}) {
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
        <Field label="Ad (TR)">
          <TextInput value={v.nameTr} onChange={(x) => set('nameTr', x)} required />
        </Field>
        <Field label="Ad (EN)">
          <TextInput value={v.nameEn} onChange={(x) => set('nameEn', x)} required />
        </Field>
        <Field label="Kısa açıklama (TR)" hint="Müşteri seçeneğin adının üzerine gelince balonda görür. Bir cümle, en fazla 300 karakter.">
          <TextInput value={v.descriptionTr} onChange={(x) => set('descriptionTr', x)} maxLength={300} />
        </Field>
        <Field label="Kısa açıklama (EN)">
          <TextInput value={v.descriptionEn} onChange={(x) => set('descriptionEn', x)} maxLength={300} />
        </Field>
        <Field label="Uzun açıklama (TR)" hint="Seçeneğin adına tıklanınca ekranın ortasında açılan panelde görünür. Boş satır yeni paragraf başlatır.">
          <TextInput value={v.longDescriptionTr} onChange={(x) => set('longDescriptionTr', x)} maxLength={5000} multiline />
        </Field>
        <Field label="Uzun açıklama (EN)">
          <TextInput value={v.longDescriptionEn} onChange={(x) => set('longDescriptionEn', x)} maxLength={5000} multiline />
        </Field>
        <Field label="Fiyatlandırma">
          <Select
            value={v.priceType}
            onChange={(x) => set('priceType', x)}
            options={PRICE_TYPES[props.scope].map((t) => ({
              value: t,
              label: t === 'fixed' ? FIXED_LABEL[props.scope] : PRICE_TYPE_LABELS[t],
            }))}
          />
        </Field>
        <Field
          label={isPercent ? 'Oran' : 'Tutar'}
          hint={
            isPercent
              ? `Yüzde, ${PERCENT_BASE[props.scope]} üzerinden. İndirim için eksi değer girin.`
              : `${currency}. İndirim için eksi değer girin.`
          }
        >
          <NumInput
            value={v.amount}
            onChange={(x) => set('amount', x ?? 0)}
            divisor={100}
            integer
            suffix={isPercent ? '%' : currency}
          />
        </Field>
        <Field
          label="Seçim grubu"
          hint="Aynı grup adını taşıyan seçeneklerden yalnız biri seçilebilir. Müşteriye başlık olarak görünür: iki dilde “Tane boyutu / Grain size” biçiminde yazın. Boş bırakılırsa bağımsız onay kutusu olur."
        >
          <TextInput value={v.groupName} onChange={(x) => set('groupName', x.trim() === '' ? null : x)} />
        </Field>
        {props.scope === 'container' && props.containerTypes && (
          <Field label="Geçerli konteyner" hint="Tümü seçilirse her konteyner tipinde görünür.">
            <Select
              value={String(v.containerTypeId ?? '')}
              onChange={(x) => set('containerTypeId', x === '' ? null : Number(x))}
              options={[
                { value: '', label: 'Tüm konteyner tipleri' },
                ...props.containerTypes.map((t) => ({ value: String(t.id), label: `${t.code} · ${t.nameTr}` })),
              ]}
            />
          </Field>
        )}
        <Field label="Sıra">
          <NumInput value={v.sortOrder} onChange={(x) => set('sortOrder', x ?? 0)} integer />
        </Field>
      </div>
      <div class="adm-toggles">
        <Toggle
          checked={v.isMandatory}
          onChange={(x) => set('isMandatory', x)}
          label="Zorunlu: müşteri kaldıramaz, fiyata her zaman eklenir"
        />
        <Toggle
          checked={v.isDefault}
          onChange={(x) => set('isDefault', x)}
          label="Varsayılan: müşteri ekranında seçili gelir"
          disabled={v.isMandatory}
        />
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

export function OptionsEditor(props: {
  scope: OptionScope;
  rows: OptionRow[];
  createPath: string;
  itemPath: (id: number) => string;
  onChanged: () => void;
  containerTypes?: ContainerType[];
  emptyText?: string;
}) {
  const { currency } = useAdmin();
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const action = useAction();
  const edit = (x: number | 'new' | null) => {
    action.clear();
    setEditing(x);
  };

  const save = async (draft: Draft) => {
    const ok = await action.run(() =>
      editing === 'new' ? api.post(props.createPath, draft) : api.put(props.itemPath(editing as number), draft),
    );
    if (ok) {
      edit(null);
      props.onChanged();
    }
    return ok;
  };

  const remove = async (row: OptionRow) => {
    if (!confirm(`"${row.nameTr}" seçeneği silinsin mi?`)) return;
    if (await action.run(() => api.del(props.itemPath(row.id)))) props.onChanged();
  };

  const typeCode = (id: number | null | undefined) =>
    id == null ? 'Tümü' : (props.containerTypes?.find((t) => t.id === id)?.code ?? `#${id}`);

  return (
    <div>
      <ErrorBox error={action.error} />
      {props.rows.length === 0 && editing !== 'new' && (
        <p class="adm-muted">{props.emptyText ?? 'Henüz seçenek yok.'}</p>
      )}
      {props.rows.length > 0 && (
        <table class="adm-table">
          <thead>
            <tr>
              <th>Seçenek</th>
              {props.scope === 'container' && <th>Konteyner</th>}
              <th>Grup</th>
              <th>Fiyat</th>
              <th>Durum</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {props.rows.map((row) =>
              editing === row.id ? (
                <tr key={row.id}>
                  <td colSpan={props.scope === 'container' ? 6 : 5}>
                    <OptionForm
                      scope={props.scope}
                      initial={payload(row)}
                      containerTypes={props.containerTypes}
                      onSave={save}
                      onCancel={() => edit(null)}
                      busy={action.busy}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={row.id} class={row.active ? '' : 'adm-row--off'}>
                  <td>
                    <strong>{row.nameTr}</strong>
                    <div class="adm-muted">{row.nameEn}</div>
                  </td>
                  {props.scope === 'container' && <td>{typeCode(row.containerTypeId)}</td>}
                  <td>{row.groupName ?? <span class="adm-muted">Bağımsız</span>}</td>
                  <td class="adm-nowrap">
                    {formatOptionPrice(row.priceType, row.amount, currency)}
                    {row.priceType === 'fixed' && <div class="adm-muted">{FIXED_LABEL[props.scope]}</div>}
                  </td>
                  <td>
                    <div class="adm-badges">
                      {row.active ? <Badge tone="ok">Aktif</Badge> : <Badge tone="off">Pasif</Badge>}
                      {row.isMandatory && <Badge tone="warn">Zorunlu</Badge>}
                      {row.isDefault && !row.isMandatory && <Badge>Varsayılan</Badge>}
                    </div>
                  </td>
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
        <OptionForm
          scope={props.scope}
          initial={emptyDraft(props.scope)}
          containerTypes={props.containerTypes}
          onSave={save}
          onCancel={() => edit(null)}
          busy={action.busy}
        />
      ) : (
        <div class="adm-form__actions">
          <Button variant="primary" onClick={() => edit('new')} disabled={editing !== null}>
            + Seçenek ekle
          </Button>
        </div>
      )}
    </div>
  );
}
