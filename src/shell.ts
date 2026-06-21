// @chirag127/astro-shell — opinionated Astro defineConfig wrapper.
//
// Provides the 3 standard integrations every chirag127/oriz family site uses
// (React + sitemap + MDX) and Tailwind v4 vite plugin. Apps pass `site` and
// optional overrides; the wrapper merges them so the family default stays
// consistent without forcing every site to repeat boilerplate.
//
// Consolidates the boilerplate from 11 astro.config.{mjs,ts} files.
//
// @example
//   import { shell } from '@chirag127/astro-shell/shell'
//   export default shell({ site: 'https://blog.oriz.in' })
//
// @example with extras
//   import { shell } from '@chirag127/astro-shell/shell'
//   import pagefind from 'astro-pagefind'
//   export default shell({
//     site: 'https://blog.oriz.in',
//     integrations: [pagefind()],
//     vite: { optimizeDeps: { exclude: ['pdfjs-dist'] } },
//   })
import mdx from '@astrojs/mdx'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

interface ShellOptions {
  /** Required canonical site URL (e.g. 'https://blog.oriz.in'). */
  site: string
  /** Extra integrations appended after [react, sitemap, mdx]. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  integrations?: any[]
  /** Extra vite config. `plugins` are appended after `tailwindcss()`. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vite?: Record<string, any>
  /** Astro output mode. Defaults to 'static'. */
  output?: 'static' | 'server'
  /** Whether to include the default mdx() integration. Defaults to true. */
  includeMdx?: boolean
  /** Whether to include the default sitemap() integration. Defaults to true. */
  includeSitemap?: boolean
  /** Options forwarded to sitemap() when included. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sitemap?: Record<string, any>
  /** Extra fields merged into the defineConfig() call (e.g. markdown, build). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export function shell(opts: ShellOptions) {
  const {
    site,
    integrations = [],
    vite = {},
    output = 'static',
    includeMdx = true,
    includeSitemap = true,
    sitemap: sitemapOpts,
    ...rest
  } = opts

  const defaultIntegrations: unknown[] = [react()]
  if (includeSitemap) defaultIntegrations.push(sitemapOpts ? sitemap(sitemapOpts) : sitemap())
  if (includeMdx) defaultIntegrations.push(mdx())

  const { plugins: extraVitePlugins = [], ...restVite } = vite

  return defineConfig({
    site,
    output,
    trailingSlash: 'ignore',
    build: { format: 'directory' },
    ...rest,
    integrations: [...defaultIntegrations, ...integrations],
    vite: {
      plugins: [tailwindcss(), ...extraVitePlugins],
      ...restVite,
    },
  })
}
