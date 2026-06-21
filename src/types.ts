// @chirag127/astro-shell — type definitions.
//
// `OrizSiteConfig` is the small string-bag describing a family site, used by
// per-app `src/lib/siteConfig.ts` modules and consumed by `BaseLayout` for
// canonical URL, page titles, and JSON-LD descriptions.
//
// Consolidates 8 vendored copies of the same interface across apps.
export interface OrizSiteConfig {
  /** Short identifier (e.g. 'blog', 'books', 'finance'). */
  slug: string
  /** Display name (e.g. 'Blog', 'Books', 'book·lore'). */
  name: string
  /** Canonical origin including https:// (e.g. 'https://blog.oriz.in'). */
  origin: string
  /** One-line tagline used in <title>, hero, and meta description. */
  tagline: string
  /** Longer description for JSON-LD / OG. Optional. */
  description?: string
}
