// astro-shell/src/pricing-url.ts
//
// pricingUrl(fromSlug) — the single helper every non-home app should
// use for its "Upgrade" / "Pricing" links.
//
// Background: per the Razorpay single-domain rule (knowledge/decisions/
// architecture/billing-webhook-cf-pages-function.md and user mandate
// 2026-06-22), oriz.in/pricing is the ONLY checkout surface. Every
// other app's pricing/upgrade link redirects to oriz.in/pricing with
// ?from=<app-slug> for attribution.
//
// In dev (import.meta.env.PROD === false) we fall back to the local
// /pricing route so devs can iterate without oriz.in running.
//
// Usage:
//   import { pricingUrl } from '@chirag127/astro-shell'
//   <a href={pricingUrl('pivot')}>Upgrade</a>
//
// Production: https://oriz.in/pricing?from=pivot
// Dev:        /pricing

export function pricingUrl(fromSlug: string): string {
  return import.meta.env.PROD
    ? `https://oriz.in/pricing?from=${encodeURIComponent(fromSlug)}`
    : '/pricing'
}
