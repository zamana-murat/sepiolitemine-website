/**
 * BRAND CONFIG — Tek Kaynak (B5 — Locked Rule)
 *
 * Site, sepiolite işi yapan firmalara yıllık kiralanabilir. Kiracı değiştiğinde
 * SADECE BU DOSYA + markdown içerikleri + assets-source/ görselleri revize edilir.
 * Kod, layout, component, route — hiçbiri değişmez.
 *
 * Layout.astro, Header.astro, Footer.astro, schema.org JSON-LD üretimi —
 * hepsi buradan çeker.
 */

export const BRAND = {
  /** Marka adı (UI'da görünür) */
  name: 'Sepiolite Mine',

  /** Legal şirket adı (footer, sözleşmeler, schema.org Organization.legalName) */
  legalName: 'Sepiolite Mine',

  /** Kısa marka adı (PWA short_name, mobil add-to-home) */
  shortName: 'SepioMine',

  /** Tek cümle açıklama (SEO meta description fallback, schema.org Organization.description) */
  description:
    "Premium Turkish sepiolite supplier — raw and processed sepiolite for agriculture, oil & gas drilling, construction, cat litter, and industrial markets globally.",

  /** Tagline (anasayfa hero, OG title fallback) */
  tagline: 'Premium Turkish Sepiolite Supplier',

  /** Owner / sahibi (Person schema için; site içeriğinde geçmez B6'ya göre) */
  owner: {
    name: 'Murat Özsaygılı',
    role: 'Owner',
  },

  /** Resmi adres (LocalBusiness/PostalAddress schema, footer) */
  address: {
    city: 'Ankara',
    country: 'Türkiye',
    countryCode: 'TR',
    /** Detay adres yayında değil — kiracı sağlarsa eklenir */
    streetAddress: '',
    postalCode: '',
  },

  /** İletişim — telefon yayında, e-posta internal (C4 — sitede mailto: YOK) */
  contact: {
    /** Header CTA, footer, contact sayfası, schema.org telephone */
    phone: '+90 530 490 4740',
    /** form mailini yönlendireceğimiz adres — SİTEDE GÖRÜNMEZ (C4) */
    internalEmail: 'info@sepiolitemine.com',
    /** Resend "from" adresi — Phase 4'te ayarlanır */
    formFromEmail: 'noreply@sepiolitemine.com',
    /** WhatsApp linki — varsa kullan, yoksa null */
    whatsapp: null as string | null,
  },

  /** Sosyal kanallar — Person/Organization sameAs için */
  social: {
    linkedin: null as string | null, // B-özel: LinkedIn şu anlık YOK
    x: null as string | null,
    youtube: null as string | null,
  },

  /** Brand renk paleti (CSS değişkenlerinin TS karşılığı) */
  colors: {
    primary: '#C9922A', // gold
    primaryLight: '#E8B84B',
    primaryDark: '#9A6E1A',
    dark: '#1C1410', // earth
    darkMid: '#2E2118',
    cream: '#F7F3EE',
    creamDark: '#EDE6DC',
    stone: '#7A6652',
    accentTeal: '#2C8C7A',
    white: '#FFFFFF',
  },

  /** Dil yapılandırması — Astro i18n ile sync */
  i18n: {
    defaultLocale: 'en' as const,
    locales: ['en', 'tr'] as const,
    localeNames: {
      en: 'English',
      tr: 'Türkçe',
    } as Record<string, string>,
  },

  /** Marka politikaları (Brand-Specific Locked Rules — Brainstorm'dan) */
  policy: {
    /** B1 — Metric-only unit system */
    units: 'metric' as const,
    /** B2 — Fiyat görünmez, "Request Quote" CTA */
    showPrices: false,
    /** B3 — AI bot tutumu (robots.txt için) */
    aiBots: 'disallow' as const, // 'disallow' | 'allow' | 'partial'
    /** B6 — /about sayfası eklenmiyor (kiralık model) */
    aboutPageEnabled: false,
  },

  /** Plan C — Blog config */
  blog: {
    enabled: true,
    title: 'Sepiolite Mine — Insights',
    description:
      'Technical guides, industry applications, market insights, and sourcing know-how for B2B sepiolite buyers worldwide.',
    postsPerPage: 10,
    newsletter: {
      enabled: true,
      provider: 'resend' as const,
      audienceId: '', // Phase C-5'te Resend audience oluşturulunca doldur
    },
    categories: [
      { slug: 'technical-guides', label: 'Technical Guides', description: 'Spec, properties, and how-to fundamentals.' },
      { slug: 'industry-applications', label: 'Industry Applications', description: 'Sector-specific deep dives.' },
      { slug: 'market-insights', label: 'Market Insights', description: 'Trends, regulations, and pricing dynamics.' },
      { slug: 'sourcing-logistics', label: 'Sourcing & Logistics', description: "Buyer's guides for industrial mineral procurement." },
    ],
  },

  /** Schema.org Organization defaults */
  schema: {
    organizationType: 'Organization' as const,
    foundingYear: 1995, // Akmin Mining historical reference
    sameAs: [] as string[], // doldurulacak — LinkedIn yoksa boş kalır
  },

  /** Sertifikalar (sustainability sayfası, schema.org hasCredential) */
  certifications: [
    // Phase 3'te eski sitedan çıkarılacak; şu anlık placeholder
  ] as Array<{
    name: string;
    issuer: string;
    image?: string;
    description?: string;
  }>,
} as const;

export type BrandConfig = typeof BRAND;
