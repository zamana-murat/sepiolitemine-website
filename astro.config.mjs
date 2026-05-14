import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://sepiolitemine.com',
  output: 'static',
  trailingSlash: 'always',
  compressHTML: true,
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
  build: {
    /* 'always': her sayfanın CSS'i HTML'e inline gömülür. Render-blocking
       <link rel="stylesheet"> kaldırılır, LCP iyileşir. Trade-off: HTML +25KB
       (brotli ile ~5KB). B2B single-page-visit profili için kazançlı.
       Multi-page visitors için cache avantajı kaybedilir; cache'i Cloudflare
       proxy katmanında kompanse ediyoruz. */
    inlineStylesheets: 'always',
    assets: '_astro',
  },
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'tr'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
  integrations: [
    sitemap({
      changefreq: 'monthly',
      priority: 0.7,
      lastmod: new Date(),
      // Sitemap-level hreflang: aynı slug bilingual sayfalar için otomatik
      // (anasayfa, applications/, products/, contact/, markets/, sustainability/).
      // Translated slug detay sayfaları için manuel serialize ile ekleniyor.
      i18n: {
        defaultLocale: 'en',
        locales: {
          en: 'en-US',
          tr: 'tr-TR',
        },
      },
      serialize(item) {
        // Detail page slug mappings (EN ↔ TR)
        const productMap = {
          'raw-sepiolite-ore': 'ham-sepiyolit-cevheri',
          'granulated-sepiolite': 'granule-sepiyolit',
          'milled-sepiolite-powder': 'ogutulmus-sepiyolit-tozu',
          'drilling-grade-sepiolite': 'sondaj-kalitesi-sepiyolit',
          'agricultural-sepiolite': 'tarimsal-sepiyolit',
          'construction-insulation-grade': 'insaat-yalitim-kalitesi',
        };
        const applicationMap = {
          'pet-care-cat-litter': 'evcil-hayvan-kedi-kumu',
          'agriculture': 'tarim',
          'oil-gas-drilling': 'petrol-gaz-sondaj',
          'construction': 'insaat',
          'environmental-remediation': 'cevre-rehabilitasyon',
          'paints-coatings': 'boya-kaplama',
          'catalysis-chemical': 'kataliz-kimya',
          'pharma-cosmetics': 'ilac-kozmetik',
          'bioplastics': 'biyoplastik',
        };
        const url = item.url;
        const site = 'https://sepiolitemine.com';

        for (const [type, map] of [['products', productMap], ['applications', applicationMap]]) {
          for (const [en, tr] of Object.entries(map)) {
            if (url === `${site}/${type}/${en}/`) {
              item.links = [
                { url: `${site}/${type}/${en}/`, lang: 'en' },
                { url: `${site}/tr/${type}/${tr}/`, lang: 'tr' },
                { url: `${site}/${type}/${en}/`, lang: 'x-default' },
              ];
              return item;
            }
            if (url === `${site}/tr/${type}/${tr}/`) {
              item.links = [
                { url: `${site}/${type}/${en}/`, lang: 'en' },
                { url: `${site}/tr/${type}/${tr}/`, lang: 'tr' },
                { url: `${site}/${type}/${en}/`, lang: 'x-default' },
              ];
              return item;
            }
          }
        }
        return item;
      },
    }),
  ],
  vite: {
    build: {
      cssCodeSplit: true,
    },
  },
});
