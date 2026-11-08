/**
 * Turkish rendering of admin API errors. The API speaks English (shared with the public
 * configurator); the admin panel translates field paths and known messages here.
 */

const FIELD_LABELS: Record<string, string> = {
  slug: 'Slug',
  nameTr: 'Ad (TR)',
  nameEn: 'Ad (EN)',
  descriptionTr: 'Açıklama (TR)',
  descriptionEn: 'Açıklama (EN)',
  hsCode: 'GTİP / HS kodu',
  specs: 'Teknik özellikler',
  labelTr: 'Özellik (TR)',
  labelEn: 'Özellik (EN)',
  value: 'Değer',
  unit: 'Birim',
  sortOrder: 'Sıra',
  type: 'Tip',
  netWeightKg: 'Net ağırlık',
  grossWeightKg: 'Brüt ağırlık',
  lengthMm: 'Uzunluk',
  widthMm: 'Genişlik',
  heightMm: 'Yükseklik',
  maxTiers: 'İstif katı',
  priceBasis: 'Fiyat esası',
  priceCents: 'Fiyat',
  groupName: 'Seçim grubu',
  priceType: 'Fiyatlandırma',
  amount: 'Tutar / oran',
  containerTypeId: 'Geçerli konteyner',
  docType: 'Belge tipi',
  titleTr: 'Başlık (TR)',
  titleEn: 'Başlık (EN)',
  innerLengthMm: 'İç uzunluk',
  innerWidthMm: 'İç genişlik',
  innerHeightMm: 'İç yükseklik',
  doorWidthMm: 'Kapı genişliği',
  doorHeightMm: 'Kapı yüksekliği',
  tareKg: 'Dara',
  maxPayloadKg: 'Teknik maks. yük',
  practicalPayloadKg: 'Pratik yük sınırı',
  currency: 'Para birimi',
  quote_validity_days: 'Teklif geçerlilik süresi',
  quote_number_prefix: 'Teklif numarası öneki',
  incoterm: 'Teslim şekli (Incoterm)',
  incoterm_place: 'Teslim yeri',
  payment_terms_en: 'Ödeme koşulları (EN)',
  payment_terms_tr: 'Ödeme koşulları (TR)',
  offer_notes_en: 'Teklif notları (EN)',
  offer_notes_tr: 'Teklif notları (TR)',
  adminNote: 'İç not',
};

/** "specs.0.labelTr" → "Teknik özellikler 1 · Özellik (TR)" */
export function fieldLabel(path: string): string {
  if (!path) return '';
  return path
    .split('.')
    .map((seg) => (/^\d+$/.test(seg) ? String(Number(seg) + 1) : (FIELD_LABELS[seg] ?? seg)))
    .join(' ')
    .replace(/ (\d+) /, ' $1 · ');
}

const EXACT: Record<string, string> = {
  'Validation failed': 'Girilen değerlerde hata var.',
  'Duplicate value (must be unique)': 'Bu değer zaten kullanılıyor (örn. aynı slug başka bir üründe var).',
  'Referenced record does not exist': 'İlgili kayıt bulunamadı, silinmiş olabilir. Sayfayı yenileyin.',
  'Internal error': 'Sunucu hatası. Tekrar deneyin; sürerse kayıtlara bakılmalı.',
  'Request rejected': 'İstek güvenlik kontrolünden geçmedi. Sayfayı yenileyip tekrar deneyin.',
  'Nothing to update': 'Değişiklik yok.',
  'file is required': 'Dosya seçilmedi.',
  'File size must be 1 B – 20 MB': 'Dosya boyutu en fazla 20 MB olmalı.',
  'Only PDF, PNG, JPEG or WebP': 'Yalnız PDF, PNG, JPEG veya WebP yüklenebilir.',
  'Admin access is not configured': 'Yönetici erişimi yapılandırılmamış.',
  Unauthorized: 'Yetkisiz erişim.',
  'grossWeightKg must be >= netWeightKg': 'Net ağırlıktan küçük olamaz.',
  'lowercase-kebab-case': 'Yalnız küçük harf, rakam ve tire kullanılabilir (örn. granul-sepiyolit).',
  'percent amount is basis points, range -10000..10000': 'Oran %-100 ile %100 arasında olmalı.',
};

const PATTERNS: [RegExp, string][] = [
  [/not found$/i, 'Kayıt bulunamadı, silinmiş olabilir.'],
  [/^Too small/i, 'Değer çok küçük.'],
  [/^Too big/i, 'Değer çok büyük.'],
  [/^Invalid option/i, 'Geçersiz seçim.'],
  [/^Invalid input: expected (number|int)/i, 'Sayı girilmeli.'],
  [/^Invalid input: expected string/i, 'Bu alan boş bırakılamaz.'],
  [/^Invalid (input|string)/i, 'Geçersiz değer.'],
  [/^HTTP 5\d\d$/, 'Sunucu hatası. Tekrar deneyin.'],
];

export function translateMessage(msg: string): string {
  if (EXACT[msg]) return EXACT[msg];
  for (const [re, tr] of PATTERNS) if (re.test(msg)) return tr;
  return msg;
}
