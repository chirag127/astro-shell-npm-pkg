// @chirag127/astro-shell
// v0.2.0 — Astro 6 base layer. Provides:
//   • `shell()` defineConfig wrapper (React + sitemap + MDX + Tailwind v4)
//   • `OrizSiteConfig` type — shared site descriptor.
//   • `tokens` — design tokens (CSS custom properties + TS const).
//   • family-data registry — FAMILY_APPS / FAMILY_PACKAGES / FAMILY_APIS /
//     FAMILY_BOOKS / FAMILY_EXTENSIONS / FAMILY_SKILLS.
//
// Subpath imports:
//   import { shell } from '@chirag127/astro-shell/shell'
//   import type { OrizSiteConfig } from '@chirag127/astro-shell/types'
//   import { FAMILY_APPS } from '@chirag127/astro-shell/family-data'
export const __pkg = '@chirag127/astro-shell' as const

export type { OrizSiteConfig } from './types'
export { shell } from './shell'
export { tokens } from './tokens'
export type { Tokens } from './tokens'
export { pricingUrl } from './pricing-url'
