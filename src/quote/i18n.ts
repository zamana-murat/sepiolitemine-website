/** Configurator strings (EN / TR). Turkish: no em-dash (C8), no artificial promises (C9). */
import type { CatalogOption, IssueCode, QuoteIssue } from '../lib/quote/types';

export type Locale = 'en' | 'tr';

/** Group names are stored once; "Tane boyutu / Grain size" shows the TR or EN half. */
export function groupLabel(group: string, locale: Locale): string {
  const parts = group.split(' / ');
  if (parts.length !== 2) return group;
  return (locale === 'tr' ? parts[0] : parts[1]).trim();
}

const en = {
  loading: 'Loading products…',
  loadError: 'The product catalogue could not be loaded. Please refresh the page.',
  noProducts: 'No products are available for online quotes at the moment. Please contact us.',
  retry: 'Try again',
  products: 'Products',
  productsHint: 'Choose a packaging and add it to the selected container.',
  addProduct: '+ Add product',
  chooseProduct: (n: number) => `Choose a product for container ${n}`,
  close: 'Close',
  add: 'Add',
  details: 'Product details',
  hsCode: 'HS code',
  packagings: 'Packaging',
  dims: 'Dimensions (L × W × H)',
  tiers: (n: number) => (n > 1 ? `Stackable ${n} high` : 'Not stackable'),
  productOptions: 'Available options',
  noDescription: 'No description yet.',
  specs: 'Specifications',
  documents: 'Documents',
  addTo: (n: number) => `Add to container ${n}`,
  added: (qty: number, name: string, n: number) => `${qty} × ${name} added to container ${n}`,
  bigbag: 'Big bag',
  pallet: 'Pallet',
  perTon: '/ t',
  perUnit: '/ unit',
  perContainer: '/ container',
  netGross: (net: string, gross: string) => `Net ${net} kg · gross ${gross} kg`,
  containers: 'Your containers',
  containersHint: 'Each tab is one container configuration. Set how many identical containers you need with the count.',
  container: (n: number) => `Container ${n}`,
  containerType: 'Container type',
  containerCount: 'Number of containers',
  countHint: (n: number) => (n > 1 ? `${n} identical containers with this configuration` : 'One container with this configuration'),
  decreaseCount: 'Fewer containers',
  increaseCount: 'More containers',
  perContainer1: 'per container',
  addContainer: '+ Add container',
  duplicate: 'Duplicate',
  remove: 'Remove',
  selected: 'Selected: products are added here',
  select: 'Add products here',
  empty: 'This container is empty.',
  emptyHint: 'Add a product and its packaging; the loading plan and price update as you go.',
  loadingPlan: 'Loading plan',
  orderTotal: 'Order total',
  containerTotalCount: (n: number) => (n === 1 ? '1 container' : `${n} containers`),
  toSummary: 'Summary',
  hideDetails: 'Hide details',
  moreInfo: 'Click for details',
  stackLimited: (here: number, max: number, h: string, inner: string, alt?: string) =>
    `Stacked ${here} high in this container: ${max} × ${h} mm is above the inner height of ${inner} mm.` +
    (alt ? ` In a ${alt} it stacks ${max} high.` : ''),
  clickForMore: 'Click for more',
  weight: 'Weight',
  floor: 'Floor',
  ofLimit: (used: string, limit: string) => `${used} of ${limit} t`,
  floorOf: (used: string, total: string) => `${used} of ${total} m`,
  quantity: 'Quantity',
  decrease: 'Decrease quantity',
  increase: 'Increase quantity',
  fill: 'Fill',
  fillTitle: 'Add as many as still fit in this container',
  removeLine: 'Remove line',
  options: 'Options',
  none: 'None',
  included: 'included',
  goods: 'Goods',
  subtotal: 'Subtotal',
  containerServices: 'Container services',
  orderServices: 'Order services',
  summary: 'Summary',
  summaryHint: 'All containers, services and the delivery term in one place.',
  colProduct: 'Product',
  colQty: 'Qty',
  colNet: 'Net t',
  colUnitPrice: 'Unit price',
  colAmount: 'Amount',
  oneContainer: 'One container',
  times: (n: number) => `× ${n} containers`,
  delivery: 'Delivery term',
  deliveryHint: 'Prices and payment terms depend on the delivery term.',
  payment: 'Payment',
  grossWeight: 'Gross weight',
  containersCount: 'Containers',
  containersTotal: 'Containers',
  total: 'Total',
  netWeight: 'Net weight',
  units: 'Units',
  door: 'Door',
  innerSize: (l: string, w: string, h: string) => `Inner size ${l} × ${w} × ${h} mm`,
  stackLegend: 'Roof, left wall and doors are drawn see-through.',
  inContainer: 'In this container',
  drawingLabel: (n: number, code: string) => `Top view of container ${n} (${code}) loading plan`,
  requestOffer: 'Get soft offer (PDF)',
  requestIntro: 'We prepare the PDF from the prices above and e-mail you a copy.',
  formUnavailable: 'Online offers are not available right now. Please send your request through the contact page.',
  contactPage: 'Contact page',
  fName: 'Full name',
  fCompany: 'Company',
  fEmail: 'E-mail',
  fCountry: 'Country',
  fPhone: 'Phone (optional)',
  fNote: 'Note for our sales team (optional)',
  consent: 'I agree that my details are stored to prepare and follow up this offer, as described in the',
  privacy: 'privacy policy',
  submit: 'Create PDF offer',
  submitting: 'Preparing your offer…',
  cancel: 'Cancel',
  botCheck: 'Please complete the security check.',
  done: (n: string) => `Your soft offer ${n} is ready.`,
  download: 'Download PDF',
  emailSent: (e: string) => `A copy has been sent to ${e}.`,
  emailNotSent: 'We could not e-mail a copy; please download the PDF now.',
  newOffer: 'Change the selection for a new offer',
  errPriceChanged: (total: string) => `Prices were updated meanwhile. The new total is ${total}. Please review and submit again.`,
  errInvalid: 'The selection is no longer valid (a product or option was changed). Please review it.',
  errRate: 'Too many requests. Please try again later or use the contact page.',
  errBot: 'The security check failed. Please try again.',
  errFields: 'Please check the highlighted fields.',
  errGeneric: 'The offer could not be created. Please try again.',
  errRequired: 'Required',
  errEmail: 'Enter a valid e-mail address',
  fixIssues: 'Resolve the highlighted issues to request an offer.',
  disclaimer:
    'Prices are indicative and become binding only with a confirmed proforma invoice. The loading plan is an estimate; final loading is confirmed with the booking.',
  reset: 'Start over',
  resetConfirm: 'Remove all containers and start over?',
  savedLocally: 'Your selection is kept in this browser.',
};

type Strings = typeof en;

const tr: Strings = {
  loading: 'Ürünler yükleniyor…',
  loadError: 'Ürün kataloğu yüklenemedi. Lütfen sayfayı yenileyin.',
  noProducts: 'Şu anda çevrim içi teklife açık ürün yok. Lütfen bizimle iletişime geçin.',
  retry: 'Tekrar dene',
  products: 'Ürünler',
  productsHint: 'Bir ambalaj seçin ve seçili konteynere ekleyin.',
  addProduct: '+ Ürün ekle',
  chooseProduct: (n: number) => `${n}. konteyner için ürün seçin`,
  close: 'Kapat',
  add: 'Ekle',
  details: 'Ürün detayları',
  hsCode: 'GTİP',
  packagings: 'Ambalaj',
  dims: 'Ölçüler (U × G × Y)',
  tiers: (n: number) => (n > 1 ? `${n} kat istiflenebilir` : 'İstiflenemez'),
  productOptions: 'Seçenekler',
  noDescription: 'Henüz açıklama yok.',
  specs: 'Teknik özellikler',
  documents: 'Belgeler',
  addTo: (n: number) => `${n}. konteynere ekle`,
  added: (qty: number, name: string, n: number) => `${qty} × ${name}, ${n}. konteynere eklendi`,
  bigbag: 'Bigbag',
  pallet: 'Palet',
  perTon: '/ ton',
  perUnit: '/ adet',
  perContainer: '/ konteyner',
  netGross: (net: string, gross: string) => `Net ${net} kg · brüt ${gross} kg`,
  containers: 'Konteynerleriniz',
  containersHint: 'Her sekme bir konteyner düzenidir. Aynı düzenden kaç konteyner istediğinizi adet ile belirleyin.',
  container: (n: number) => `${n}. konteyner`,
  containerType: 'Konteyner tipi',
  containerCount: 'Konteyner adedi',
  countHint: (n: number) => (n > 1 ? `Bu düzenden ${n} özdeş konteyner` : 'Bu düzenden bir konteyner'),
  decreaseCount: 'Konteyner adedini azalt',
  increaseCount: 'Konteyner adedini artır',
  perContainer1: 'konteyner başına',
  addContainer: '+ Konteyner ekle',
  duplicate: 'Kopyala',
  remove: 'Kaldır',
  selected: 'Seçili: ürünler buraya eklenir',
  select: 'Ürünleri buraya ekle',
  empty: 'Bu konteyner boş.',
  emptyHint: 'Bir ürün ve ambalajını ekleyin; yükleme planı ve fiyat siz ekledikçe güncellenir.',
  loadingPlan: 'Yükleme planı',
  orderTotal: 'Sipariş toplamı',
  containerTotalCount: (n: number) => `${n} konteyner`,
  toSummary: 'Özet',
  hideDetails: 'Detayları gizle',
  moreInfo: 'Ayrıntılar için tıklayın',
  stackLimited: (here: number, max: number, h: string, inner: string, alt?: string) =>
    `Bu konteynerde ${here} kat istiflenir: ${max} × ${h} mm, ${inner} mm iç yüksekliği aşıyor.` +
    (alt ? ` ${alt} konteynerde ${max} kat istiflenir.` : ''),
  clickForMore: 'Devamı için tıklayın',
  weight: 'Ağırlık',
  floor: 'Taban',
  ofLimit: (used: string, limit: string) => `${used} / ${limit} ton`,
  floorOf: (used: string, total: string) => `${used} / ${total} m`,
  quantity: 'Adet',
  decrease: 'Adedi azalt',
  increase: 'Adedi artır',
  fill: 'Doldur',
  fillTitle: 'Bu konteynere sığan en fazla adede tamamla',
  removeLine: 'Satırı kaldır',
  options: 'Seçenekler',
  none: 'Yok',
  included: 'dahil',
  goods: 'Ürün bedeli',
  subtotal: 'Ara toplam',
  containerServices: 'Konteyner hizmetleri',
  orderServices: 'Sipariş hizmetleri',
  summary: 'Özet',
  summaryHint: 'Tüm konteynerler, hizmetler ve teslim şekli bir arada.',
  colProduct: 'Ürün',
  colQty: 'Adet',
  colNet: 'Net ton',
  colUnitPrice: 'Birim fiyat',
  colAmount: 'Tutar',
  oneContainer: 'Bir konteyner',
  times: (n: number) => `× ${n} konteyner`,
  delivery: 'Teslim şekli',
  deliveryHint: 'Fiyat ve ödeme koşulları teslim şekline göre değişir.',
  payment: 'Ödeme',
  grossWeight: 'Brüt ağırlık',
  containersCount: 'Konteyner',
  containersTotal: 'Konteynerler',
  total: 'Toplam',
  netWeight: 'Net ağırlık',
  units: 'Adet',
  door: 'Kapı',
  innerSize: (l: string, w: string, h: string) => `İç ölçü ${l} × ${w} × ${h} mm`,
  stackLegend: 'Tavan, sol duvar ve kapılar saydam çizilmiştir.',
  inContainer: 'Bu konteynerde',
  drawingLabel: (n: number, code: string) => `${n}. konteyner (${code}) yükleme planı, üstten görünüm`,
  requestOffer: 'Soft offer al (PDF)',
  requestIntro: 'PDF teklifi yukarıdaki fiyatlarla hazırlanır; bir kopyası e-postanıza gönderilir.',
  formUnavailable: 'Çevrim içi teklif şu anda kullanılamıyor. Talebinizi iletişim sayfasından gönderebilirsiniz.',
  contactPage: 'İletişim sayfası',
  fName: 'Ad soyad',
  fCompany: 'Firma',
  fEmail: 'E-posta',
  fCountry: 'Ülke',
  fPhone: 'Telefon (isteğe bağlı)',
  fNote: 'Satış ekibine not (isteğe bağlı)',
  consent: 'Bilgilerimin bu teklifin hazırlanması ve takibi için saklanmasını kabul ediyorum. Ayrıntılar:',
  privacy: 'gizlilik politikası',
  submit: 'PDF teklif oluştur',
  submitting: 'Teklifiniz hazırlanıyor…',
  cancel: 'Vazgeç',
  botCheck: 'Lütfen güvenlik doğrulamasını tamamlayın.',
  done: (n: string) => `${n} numaralı soft offer hazır.`,
  download: 'PDF indir',
  emailSent: (e: string) => `Bir kopyası ${e} adresine gönderildi.`,
  emailNotSent: 'Kopya e-postayla gönderilemedi; lütfen PDF’i şimdi indirin.',
  newOffer: 'Yeni teklif için seçimi değiştirin',
  errPriceChanged: (total: string) => `Fiyatlar bu arada güncellendi. Yeni toplam ${total}. Lütfen kontrol edip tekrar gönderin.`,
  errInvalid: 'Seçim artık geçerli değil (bir ürün ya da seçenek değişti). Lütfen kontrol edin.',
  errRate: 'Çok fazla talep gönderildi. Lütfen daha sonra tekrar deneyin ya da iletişim sayfasını kullanın.',
  errBot: 'Güvenlik doğrulaması başarısız oldu. Lütfen tekrar deneyin.',
  errFields: 'Lütfen işaretli alanları kontrol edin.',
  errGeneric: 'Teklif oluşturulamadı. Lütfen tekrar deneyin.',
  errRequired: 'Zorunlu',
  errEmail: 'Geçerli bir e-posta adresi girin',
  fixIssues: 'Teklif almak için işaretli sorunları giderin.',
  disclaimer:
    'Fiyatlar bilgi amaçlıdır; onaylı proforma fatura ile bağlayıcı olur. Yükleme planı tahminidir; kesin yükleme rezervasyonla teyit edilir.',
  reset: 'Baştan başla',
  resetConfirm: 'Tüm konteynerler kaldırılıp baştan başlansın mı?',
  savedLocally: 'Seçiminiz bu tarayıcıda saklanır.',
};

export const STRINGS: Record<Locale, Strings> = { en, tr };

type IssueText = (p: Record<string, string | number>) => string;

const ISSUES: Record<Locale, Record<IssueCode, IssueText>> = {
  en: {
    no_containers: () => 'Add at least one container.',
    too_many_containers: (p) => `At most ${p.max} containers per offer.`,
    invalid_container_count: (p) => `Enter a whole number of containers between 1 and ${p.max}.`,
    no_delivery_term: () => 'Choose a delivery term.',
    unknown_delivery_term: () => 'This delivery term is no longer offered. Choose another one.',
    too_many_lines: (p) => `At most ${p.max} lines per container.`,
    unknown_container: () => 'This container type is no longer available. Choose another type.',
    empty_container: () => 'This container is empty.',
    unknown_packaging: () => 'This product is no longer available.',
    invalid_quantity: (p) => `Enter a whole number between 1 and ${p.max}.`,
    unknown_option: () => 'A selected option is not available here.',
    option_group_conflict: (p) => `Choose only one option for “${groupLabel(String(p.group), 'en')}”.`,
    unit_too_tall: (p) => `Too tall for this container (${p.heightMm} mm, inner height ${p.innerHeightMm} mm).`,
    unit_too_large: () => 'The footprint is too large for this container.',
    unit_door: (p) => `Does not pass the container door (${p.doorWidthMm} × ${p.doorHeightMm} mm).`,
    container_overweight: (p) => `Over the weight limit: ${p.grossKg} kg of ${p.limitKg} kg.`,
    container_floor_overflow: () => 'Does not fit on the floor. Reduce quantities or add another container.',
    container_low_utilization: (p) => `Only ${p.percent}% full. You can add more products or choose a smaller container.`,
  },
  tr: {
    no_containers: () => 'En az bir konteyner ekleyin.',
    too_many_containers: (p) => `Bir teklifte en fazla ${p.max} konteyner olabilir.`,
    invalid_container_count: (p) => `Konteyner adedi 1 ile ${p.max} arasında bir tam sayı olmalı.`,
    no_delivery_term: () => 'Bir teslim şekli seçin.',
    unknown_delivery_term: () => 'Bu teslim şekli artık sunulmuyor. Başka birini seçin.',
    too_many_lines: (p) => `Bir konteynerde en fazla ${p.max} satır olabilir.`,
    unknown_container: () => 'Bu konteyner tipi artık sunulmuyor. Başka bir tip seçin.',
    empty_container: () => 'Bu konteyner boş.',
    unknown_packaging: () => 'Bu ürün artık sunulmuyor.',
    invalid_quantity: (p) => `1 ile ${p.max} arasında bir tam sayı girin.`,
    unknown_option: () => 'Seçilen bir seçenek burada geçerli değil.',
    option_group_conflict: (p) => `“${groupLabel(String(p.group), 'tr')}” için yalnız bir seçenek seçin.`,
    unit_too_tall: (p) => `Bu konteyner için çok yüksek (${p.heightMm} mm, iç yükseklik ${p.innerHeightMm} mm).`,
    unit_too_large: () => 'Taban ölçüsü bu konteynere sığmıyor.',
    unit_door: (p) => `Konteyner kapısından geçmiyor (${p.doorWidthMm} × ${p.doorHeightMm} mm).`,
    container_overweight: (p) => `Ağırlık sınırı aşıldı: ${p.grossKg} kg / ${p.limitKg} kg.`,
    container_floor_overflow: () => 'Tabana sığmıyor. Adetleri azaltın ya da yeni konteyner ekleyin.',
    container_low_utilization: (p) => `Yalnız %${p.percent} dolu. Ürün ekleyebilir ya da daha küçük konteyner seçebilirsiniz.`,
  },
};

export function issueText(locale: Locale, issue: QuoteIssue): string {
  const fmt = new Intl.NumberFormat(locale === 'tr' ? 'tr-TR' : 'en-US');
  const params = Object.fromEntries(
    Object.entries(issue.params ?? {}).map(([k, v]) => [k, typeof v === 'number' ? fmt.format(v) : v]),
  );
  return ISSUES[locale][issue.code](params);
}

export function formatters(locale: Locale, currency: string) {
  const tag = locale === 'tr' ? 'tr-TR' : 'en-US';
  const money = new Intl.NumberFormat(tag, { style: 'currency', currency, minimumFractionDigits: 2 });
  const num = (digits = 0) => new Intl.NumberFormat(tag, { maximumFractionDigits: digits });
  return {
    money: (cents: number) => money.format(cents / 100),
    /** Signed amount for surcharges: "+$25.00" / "−$5.00" */
    signedMoney: (cents: number) => `${cents < 0 ? '−' : '+'}${money.format(Math.abs(cents) / 100)}`,
    percent: (bp: number) => {
      const v = num(2).format(Math.abs(bp) / 100);
      const sign = bp < 0 ? '−' : '+';
      return locale === 'tr' ? `${sign}%${v}` : `${sign}${v}%`;
    },
    kg: (kg: number) => num(0).format(kg),
    tons: (kg: number) => num(2).format(kg / 1000),
    mm: (mm: number) => num(0).format(mm),
    meters: (mm: number) => num(2).format(mm / 1000),
    pct: (ratio: number) => (locale === 'tr' ? `%${Math.round(ratio * 100)}` : `${Math.round(ratio * 100)}%`),
  };
}

export type Formatters = ReturnType<typeof formatters>;

/** "FOB Mersin" — Incoterm + place in the viewer's language. */
export function deliveryLabel(d: { incoterm: string | null; placeEn: string; placeTr?: string }, locale: Locale): string {
  const place = locale === 'tr' ? d.placeTr || d.placeEn : d.placeEn;
  return [d.incoterm, place].filter(Boolean).join(' ');
}

export function optionPriceLabel(o: Pick<CatalogOption, 'priceType' | 'amount'>, fmt: Formatters, locale: Locale): string {
  const t = STRINGS[locale];
  switch (o.priceType) {
    case 'percent':
      return fmt.percent(o.amount);
    case 'per_ton':
      return `${fmt.signedMoney(o.amount)} ${t.perTon}`;
    case 'per_unit':
      return `${fmt.signedMoney(o.amount)} ${t.perUnit}`;
    case 'per_container':
      return `${fmt.signedMoney(o.amount)} ${t.perContainer}`;
    default:
      return fmt.signedMoney(o.amount);
  }
}
