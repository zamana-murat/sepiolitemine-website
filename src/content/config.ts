/**
 * Content Collections Schema
 *
 * - products: 6 product detail pages (EN + TR)
 * - applications: 9 application detail pages (EN + TR)
 * - blog: blog posts (Plan C — Phase C-1+)
 *
 * EN + TR within one collection, distinguished by `locale` frontmatter.
 * Slug-translated URLs handled via `altSlug` for hreflang alternates.
 */
import { defineCollection, z } from 'astro:content';

const Locale = z.enum(['en', 'tr']);

const FaqSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

/* ── Products (EN + TR mixed, filter by locale) ─────────────────── */

const products = defineCollection({
  type: 'content',
  schema: z.object({
    locale: Locale,
    /** Slug in the OTHER locale, for hreflang alternates */
    altSlug: z.string(),

    /** SEO + Hero */
    title: z.string(),
    /** Italicized accent word for hero H1 (e.g. "Raw Sepiolite *Ore*" → "Ore") */
    titleAccent: z.string().optional(),
    description: z.string().min(80).max(200),
    badge: z.string().optional(),
    tagline: z.string(),

    /** Hero gallery */
    heroImage: z.string(),
    heroImageAlt: z.string(),
    gallery: z.array(z.object({
      image: z.string(),
      alt: z.string(),
    })).default([]),

    /** Key specs (3-4 highlighted cards) */
    keySpecs: z.array(z.object({
      value: z.string(),
      label: z.string(),
    })).default([]),

    /** Full technical specs (sidebar table) */
    techSpecs: z.array(z.object({
      label: z.string(),
      value: z.string(),
    })).default([]),

    /** Usage areas (6 cards) */
    usageAreas: z.array(z.object({
      icon: z.string(),
      title: z.string(),
      description: z.string(),
    })).default([]),

    /** Advantages (5 numbered) */
    advantages: z.array(z.object({
      title: z.string(),
      description: z.string(),
    })).default([]),
    advantageImage: z.string().optional(),
    advantageImageAlt: z.string().optional(),

    /** FAQ */
    faqs: z.array(FaqSchema).default([]),

    /** Related product slugs (within same locale) */
    relatedProducts: z.array(z.string()).default([]),

    /** Product schema.org */
    sku: z.string().optional(),
    material: z.string().optional(),

    /** Listing order + flags */
    order: z.number().default(0),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

/* ── Applications (EN + TR mixed, filter by locale) ─────────────── */

const applications = defineCollection({
  type: 'content',
  schema: z.object({
    locale: Locale,
    altSlug: z.string(),

    title: z.string(),
    titleAccent: z.string().optional(),
    description: z.string().min(80).max(200),
    badge: z.string().optional(),
    tagline: z.string(),

    heroImage: z.string().optional(),
    heroImageAlt: z.string().optional(),

    /** Hero stats (4 cards with big number + label) */
    heroStats: z.array(z.object({
      value: z.string(),
      label: z.string(),
    })).default([]),

    /** Intro paragraph (above benefits) */
    intro: z.string().optional(),

    /** Key benefits (6 cards: icon, title, description) */
    benefits: z.array(z.object({
      icon: z.string().optional(),
      title: z.string(),
      description: z.string(),
    })).default([]),

    /** Process / use cases (5 numbered steps: title + description) */
    useCases: z.array(z.object({
      title: z.string(),
      description: z.string(),
    })).default([]),

    /** Technical specs table (parameter / value) */
    specsTable: z.array(z.object({
      label: z.string(),
      value: z.string(),
    })).default([]),

    /** Recommended products (product slugs) */
    recommendedProducts: z.array(z.string()).default([]),

    /** FAQ */
    faqs: z.array(FaqSchema).default([]),

    /** Order in listings */
    order: z.number().default(0),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

/* ── Blog (Plan C) ──────────────────────────────────────────────── */

const blog = defineCollection({
  type: 'content',
  schema: ({ image }) =>
    z.object({
      title: z.string().max(70),
      description: z.string().min(120).max(160),
      publishedDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      author: z.string(),
      category: z.string(),
      tags: z.array(z.string()).default([]),
      heroImage: image().optional(),
      heroImageAlt: z.string().optional(),
      locale: Locale.default('en'),
      draft: z.boolean().default(false),
      featured: z.boolean().default(false),
      readingTime: z.number().optional(),
    }),
});

export const collections = { products, applications, blog };
