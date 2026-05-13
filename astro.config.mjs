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
    inlineStylesheets: 'auto',
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
      // i18n locale map'leri Astro 4'ün built-in i18n'inden otomatik çekilir
    }),
  ],
  vite: {
    build: {
      cssCodeSplit: true,
    },
  },
});
