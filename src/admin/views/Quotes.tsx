/** Soft offers issued from the public configurator: list, detail, status and internal note. */
import { Fragment } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { QuoteResult } from '../../lib/quote/types';
import { api } from '../api';
import type { QuoteList, QuoteListRow, QuoteStatus } from '../types';
import { Badge, Button, Card, ErrorBox, Field, Loading, Select, TextInput, formatMoney, formatNumber, useAction, useAsync } from '../ui';

const STATUS: Record<QuoteStatus, { label: string; tone: 'ok' | 'off' | 'info' | 'warn' }> = {
  new: { label: 'Yeni', tone: 'warn' },
  contacted: { label: 'Görüşülüyor', tone: 'info' },
  won: { label: 'Kazanıldı', tone: 'ok' },
  lost: { label: 'Kaybedildi', tone: 'off' },
};
const STATUS_OPTIONS = (Object.keys(STATUS) as QuoteStatus[]).map((s) => ({ value: s, label: STATUS[s].label }));

const EMAIL: Record<string, string> = { sent: 'Müşteriye gönderildi', failed: 'E-posta gönderilemedi', skipped: 'E-posta kapalı' };

const date = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Istanbul' }).format(new Date(iso));
const day = (iso: string) => new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeZone: 'Europe/Istanbul' }).format(new Date(iso));

export function Quotes(props: { navigate: (h: string) => void }) {
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  // Debounce the search box.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [query]);

  const qs = new URLSearchParams({ page: String(page) });
  if (status) qs.set('status', status);
  if (search) qs.set('q', search);
  const list = useAsync(() => api.get<QuoteList>(`/quotes?${qs}`), [status, search, page]);
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;

  return (
    <Card title="Teklifler">
      <p class="adm-muted">
        Müşterilerin teklif ekranından aldığı soft offer'lar. Her teklif, verildiği andaki fiyat ve koşullarla
        saklanır; sonradan yapılan fiyat değişiklikleri verilmiş teklifleri değiştirmez.
      </p>
      <div class="adm-filters">
        <Field label="Durum">
          <Select
            value={status}
            onChange={(x) => {
              setStatus(x);
              setPage(1);
            }}
            options={[{ value: '', label: 'Tümü' }, ...STATUS_OPTIONS]}
          />
        </Field>
        <Field label="Ara" hint="Teklif no., firma, ad ya da e-posta">
          <TextInput value={query} onChange={setQuery} />
        </Field>
      </div>
      <ErrorBox error={list.error} />
      {!list.data ? (
        list.error ? null : <Loading />
      ) : list.data.rows.length === 0 ? (
        <p class="adm-muted">{search || status ? 'Bu filtreyle teklif yok.' : 'Henüz teklif yok.'}</p>
      ) : (
        <>
          <table class="adm-table adm-table--click">
            <thead>
              <tr>
                <th>Teklif</th>
                <th>Müşteri</th>
                <th>Ülke</th>
                <th class="adm-right">Toplam</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {list.data.rows.map((r: QuoteListRow) => (
                <tr key={r.id} onClick={() => props.navigate(`#/quotes/${r.id}`)}>
                  <td>
                    <a href={`#/quotes/${r.id}`}>
                      <strong>{r.number}</strong>
                    </a>
                    <div class="adm-muted">{date(r.createdAt)}</div>
                  </td>
                  <td>
                    <strong>{r.customerCompany}</strong>
                    <div class="adm-muted">
                      {r.customerName} · {r.customerEmail}
                    </div>
                  </td>
                  <td>{r.customerCountry}</td>
                  <td class="adm-right adm-nowrap">
                    {formatMoney(r.totalCents, r.currency)}
                    <div class="adm-muted">{r.containers} konteyner</div>
                  </td>
                  <td>
                    <div class="adm-badges">
                      <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                      {r.emailStatus === 'failed' && <Badge tone="warn">E-posta hatası</Badge>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pages > 1 && (
            <div class="adm-form__actions">
              <Button onClick={() => setPage(page - 1)} disabled={page <= 1}>
                Önceki
              </Button>
              <span class="adm-muted">
                Sayfa {page} / {pages} · {list.data.total} teklif
              </span>
              <Button onClick={() => setPage(page + 1)} disabled={page >= pages}>
                Sonraki
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

interface QuoteDetailData extends Omit<QuoteListRow, 'containers'> {
  customerPhone: string;
  customerNote: string;
  adminNote: string;
  result: QuoteResult;
  terms: { incoterm: string; incotermPlace: string; validityDays: number };
  hasPdf: boolean;
}

export function QuoteDetail(props: { id: number; navigate: (h: string) => void }) {
  const q = useAsync(() => api.get<QuoteDetailData>(`/quotes/${props.id}`), [props.id]);
  const action = useAction();
  const [status, setStatus] = useState<QuoteStatus>('new');
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (q.data) {
      setStatus(q.data.status);
      setNote(q.data.adminNote);
    }
  }, [q.data]);

  if (q.error) return <ErrorBox error={q.error} />;
  if (!q.data) return <Loading />;
  const d = q.data;
  const r = d.result;
  const money = (c: number) => formatMoney(c, d.currency);

  const save = async () => {
    setSaved(false);
    if (await action.run(() => api.put(`/quotes/${d.id}`, { status, adminNote: note }))) {
      setSaved(true);
      q.reload();
    }
  };
  const remove = async () => {
    if (!confirm(`${d.number} teklifi ve PDF'i kalıcı olarak silinsin mi? Numara yeniden kullanılmaz.`)) return;
    if (await action.run(() => api.del(`/quotes/${d.id}`))) props.navigate('#/quotes');
  };

  return (
    <>
      <p>
        <a href="#/quotes">← Teklifler</a>
      </p>
      <Card
        title={`${d.number} · ${d.customerCompany}`}
        actions={
          d.hasPdf && (
            <a class="adm-btn adm-btn--primary" href={`/api/admin/quotes/${d.id}/pdf`} target="_blank" rel="noopener">
              PDF'i aç
            </a>
          )
        }
      >
        <dl class="adm-dl">
          <dt>Tarih</dt>
          <dd>{date(d.createdAt)}</dd>
          <dt>Geçerlilik</dt>
          <dd>{day(d.validUntil)}</dd>
          <dt>Toplam</dt>
          <dd>
            <strong>{money(d.totalCents)}</strong> · {d.terms.incoterm}
            {d.terms.incotermPlace && ` ${d.terms.incotermPlace}`}
          </dd>
          <dt>Müşteri</dt>
          <dd>
            {d.customerName} · {d.customerEmail}
            {d.customerPhone && ` · ${d.customerPhone}`} · {d.customerCountry}
          </dd>
          <dt>Dil</dt>
          <dd>{d.locale === 'tr' ? 'Türkçe' : 'İngilizce'}</dd>
          <dt>E-posta</dt>
          <dd>{d.emailStatus ? EMAIL[d.emailStatus] : '-'}</dd>
          {d.customerNote && (
            <>
              <dt>Müşteri notu</dt>
              <dd class="adm-pre">{d.customerNote}</dd>
            </>
          )}
        </dl>
      </Card>

      <Card title="İçerik">
        {r.containers.map((c, i) => (
          <div key={i} class="adm-quote-container">
            <h3 class="adm-subhead">
              {i + 1}. konteyner · {c.code} · {money(c.totalCents)}
            </h3>
            <table class="adm-table">
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th class="adm-right">Adet</th>
                  <th class="adm-right">Net ton</th>
                  <th class="adm-right">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {c.lines.map((l, j) => (
                  <tr key={j}>
                    <td>
                      <strong>{l.productNameTr}</strong>
                      <div class="adm-muted">
                        {l.packagingNameTr}
                        {l.options.length > 0 && ` · ${l.options.map((o) => o.nameTr).join(', ')}`}
                      </div>
                    </td>
                    <td class="adm-right">{formatNumber(l.quantity)}</td>
                    <td class="adm-right">{formatNumber(l.netKg / 1000, 2)}</td>
                    <td class="adm-right adm-nowrap">{money(l.totalCents)}</td>
                  </tr>
                ))}
                {c.options.map((o) => (
                  <tr key={`o${o.optionId}`}>
                    <td colSpan={3} class="adm-muted">
                      + {o.nameTr}
                    </td>
                    <td class="adm-right adm-nowrap">{money(o.cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <dl class="adm-dl">
          <dt>Konteynerler</dt>
          <dd>{money(r.containersTotalCents)}</dd>
          {r.orderOptions.map((o) => (
            <Fragment key={o.optionId}>
              <dt>{o.nameTr}</dt>
              <dd>{money(o.cents)}</dd>
            </Fragment>
          ))}
          <dt>Toplam</dt>
          <dd>
            <strong>{money(r.totalCents)}</strong> · net {formatNumber(r.totals.netKg / 1000, 2)} ton
          </dd>
        </dl>
      </Card>

      <Card title="Takip">
        <ErrorBox error={action.error} />
        <div class="adm-grid">
          <Field label="Durum">
            <Select value={status} onChange={(x) => setStatus(x as QuoteStatus)} options={STATUS_OPTIONS} />
          </Field>
          <Field label="İç not" hint="Yalnız panelde görünür.">
            <TextInput value={note} onChange={setNote} multiline maxLength={5000} />
          </Field>
        </div>
        <div class="adm-form__actions">
          <Button variant="primary" onClick={save} busy={action.busy}>
            Kaydet
          </Button>
          {saved && <span class="adm-saved">Kaydedildi</span>}
          <Button variant="danger" onClick={remove} disabled={action.busy}>
            Teklifi sil
          </Button>
        </div>
      </Card>
    </>
  );
}
