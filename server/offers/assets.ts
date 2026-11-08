/**
 * Fonts + logo for the PDF, read from the Pages static assets (public/fonts/pdf, public/images/logo)
 * and kept per isolate. Tests pass a Fetcher that reads from public/.
 */
import type { OfferPdfAssets } from '../pdf/offer-pdf';

export const PDF_ASSET_PATHS = {
  regular: '/fonts/pdf/OfferSans-Regular.ttf',
  semibold: '/fonts/pdf/OfferSans-SemiBold.ttf',
  display: '/fonts/pdf/OfferDisplay-Bold.ttf',
  logo: '/images/logo/logo-primary-400w.png',
} as const;

let cached: Promise<OfferPdfAssets> | null = null;

async function fetchBytes(assets: Fetcher, origin: string, path: string): Promise<Uint8Array> {
  const r = await assets.fetch(new URL(path, origin).toString());
  if (!r.ok) throw new Error(`PDF asset ${path}: HTTP ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

export function loadPdfAssets(assets: Fetcher, origin: string): Promise<OfferPdfAssets> {
  cached ??= (async () => {
    const [regular, semibold, display, logo] = await Promise.all(
      [PDF_ASSET_PATHS.regular, PDF_ASSET_PATHS.semibold, PDF_ASSET_PATHS.display, PDF_ASSET_PATHS.logo].map((p) =>
        fetchBytes(assets, origin, p),
      ),
    );
    return { regular, semibold, display, logo };
  })().catch((e) => {
    cached = null; // retry on the next request
    throw e;
  });
  return cached;
}
