# sepiolitemine.com

Astro 5 + Cloudflare Pages — premium Turkish sepiolite supplier site.

B2B platform for international wholesalers and industrial manufacturers buying sepiolite as raw material.

## Stack

- **Framework:** [Astro 5](https://astro.build) (static output)
- **Hosting:** Cloudflare Pages
- **Edge functions:** Pages Functions (contact form via Resend)
- **Mail:** Resend (transactional, outbound)
- **Analytics:** Cloudflare Web Analytics (cookieless, GDPR)
- **Fonts:** Self-hosted Inter Variable + Playfair Display Variable (woff2)
- **i18n:** EN (default, root) + TR (`/tr/` prefix)

## Local Development

```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # static build → dist/
npm run preview      # preview production build
npm run check        # TypeScript + Astro check
```

> **Note:** `npm run dev` is started by the user only (operational rule O1).

## Project Structure

```
Website/
├── src/
│   ├── config/brand.ts       ← Single source of truth for tenant brand
│   ├── styles/global.css     ← Brand tokens + self-host fonts
│   ├── layouts/Layout.astro  ← Site shell (head, header, footer)
│   ├── components/           ← Header, Footer, ...
│   ├── pages/                ← Routes (EN root + tr/ prefix)
│   └── content/              ← (Phase 3) products, applications, blog
├── public/
│   ├── fonts/                ← Self-hosted woff2 (C5)
│   ├── images/               ← Optimized WebP variants (Phase 3)
│   ├── og/                   ← Generated OG images (Phase 3)
│   ├── robots.txt
│   ├── site.webmanifest
│   ├── humans.txt
│   └── _routes.json
├── scripts/
│   ├── optimize-images.mjs   ← C1+C2 — sharp variants from assets-source/
│   └── generate-og.mjs       ← (stub) Phase 3 satori+resvg
└── astro.config.mjs
```

## Brand Configuration (Tenant Model)

This site is designed to be operated under different brand profiles. All
tenant-specific data lives in [`src/config/brand.ts`](src/config/brand.ts):
name, colors, contact, certifications, blog config. Layouts, components,
and routes never hardcode brand data.

To switch tenant: revise `brand.ts` + markdown content + replace files in
`assets-source/`. Code stays untouched.

## Deployment

Auto-deployed on push to `main` via Cloudflare Pages.

## License

Proprietary © Murat Özsaygılı.
