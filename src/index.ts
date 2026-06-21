// @chirag127/astro-shell
// v0.1.2 — Astro 6 base layer. Provides:
//   • `shell()` defineConfig wrapper (React + sitemap + MDX + Tailwind v4)
//   • `OrizSiteConfig` type — shared site descriptor.
//
// Subpath imports:
//   import { shell } from '@chirag127/astro-shell/shell'
//   import type { OrizSiteConfig } from '@chirag127/astro-shell/types'
export const __pkg = '@chirag127/astro-shell' as const

export type { OrizSiteConfig } from './types'
export { shell } from './shell'
