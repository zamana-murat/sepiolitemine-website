/** Product colours shared by the configurator drawing and the PDF loading plan. */
import type { Catalog } from '../lib/quote/types';

export const PALETTE = ['#C9922A', '#2C8C7A', '#1A5C8C', '#7A6652', '#9A6E1A', '#4F7A3A', '#8C3B2E', '#B8A898'];

/** Colour per product, by catalog order (stable between the page and the PDF). */
export function productColors(catalog: Catalog | null): (productId: number) => string {
  const index = new Map(catalog?.products.map((p, i) => [p.id, PALETTE[i % PALETTE.length]]) ?? []);
  return (productId: number) => index.get(productId) ?? PALETTE[PALETTE.length - 1];
}

/** Dark text on light swatches, white on dark ones. */
export function textOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#1C1410' : '#FFFFFF';
}
