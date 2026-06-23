// @chirag127/astro-shell/flags
//
// Runtime feature-flag helper. Reads the resolved flag tree from
// https://flags.oriz.in (CF Worker fronting CF KV which mirrors CF D1).
// Evaluates LD-style rules server-side, returns the final value.
//
// Architecture (full audit in knowledge/runbooks/feature-flags-storage-2026-06-23.md):
//   ┌────────────┐  PUT  ┌──────┐         ┌──────┐  GET tree  ┌────────────┐
//   │ admin UI   │ ────► │  D1  │ mirror► │  KV  │ ─────────► │  this lib  │
//   │  /admin/   │       │ flags│         │ flags│            │  apps/SSR  │
//   │  flags     │       │  +   │         │      │            │            │
//   └────────────┘       │rules │         └──────┘            └────────────┘
//                        └──────┘
//                          │
//                          ▼ nightly cron
//                       gist (DR)
//
// Usage in an Astro page (server-side eval at request):
//   ---
//   import { flags } from '@chirag127/astro-shell/flags'
//   import { readAuthCookie } from '@chirag127/astro-shell/auth-gate'
//   const user = readAuthCookie()
//   const f = await flags({ uid: user?.uid, tier: 'free', country: 'IN' })
//   const showRazorpay = f.bool('razorpay-checkout-enabled', true)
//   const ctaCopy = f.str('cta-copy', 'Upgrade to Pro')
//   ---
//
// The helper is fail-open: if the flag service is down, it returns the
// caller-supplied `defaultValue`. There is no scenario where flags break
// page render — that's by design (incident response, not incident cause).

/** Subset of fields a flag rule can predicate on. Apps pass whatever they have. */
export interface FlagContext {
  /** Firebase Auth uid, if signed in. */
  uid?: string
  /** 'free' | 'pro' | 'max', from Firebase custom claim. */
  tier?: 'free' | 'pro' | 'max'
  /** ISO-3166 alpha-2 country code. Set by CF edge in production. */
  country?: string
  /** App slug from family-data registry, e.g. 'oriz-omni-post-app'. */
  app?: string
}

/** One rule in the resolved flag tree. Matches segments to variant values. */
interface FlagRule {
  /** Rule priority — lower = evaluated first. */
  priority: number
  /** Segment predicate (e.g. 'tier:pro', 'rollout:5', 'app:oriz-omni-post-app'). */
  segment: string
  /** Variant value to return when this rule matches. */
  variant: string | boolean | number
}

/** Resolved tree shape served by the flags Worker. */
interface FlagTree {
  /** Schema version — bump when shape changes; old apps fall back to defaults. */
  v: 1
  /** Generated timestamp (Unix ms). */
  ts: number
  /** Flag key → { type, default, rules[] }. */
  flags: Record<
    string,
    {
      type: 'bool' | 'string' | 'number'
      default: string | boolean | number
      rules: FlagRule[]
    }
  >
}

/** Default flags origin. Override via FLAGS_ORIGIN env if testing locally. */
const FLAGS_ORIGIN =
  (typeof process !== 'undefined' && process.env?.FLAGS_ORIGIN) || 'https://flags.oriz.in'

/** Cache the tree per-request so 10 flag() calls on one page don't make 10 fetches. */
let cachedTree: FlagTree | null = null
let cachedAt = 0
const CACHE_TTL_MS = 30_000 // 30s — KV already has 60s edge cache; this is per-isolate.

async function fetchTree(): Promise<FlagTree | null> {
  if (cachedTree && Date.now() - cachedAt < CACHE_TTL_MS) return cachedTree
  try {
    const r = await fetch(`${FLAGS_ORIGIN}/tree`, {
      // Tag the request so CF logs separate flag traffic from app traffic.
      headers: { 'x-oriz-client': 'astro-shell-flags' },
    })
    if (!r.ok) return null
    const tree = (await r.json()) as FlagTree
    if (tree.v !== 1) return null
    cachedTree = tree
    cachedAt = Date.now()
    return tree
  } catch {
    // Network error / Worker down → fail-open, defaults will be used.
    return null
  }
}

/** Stable-hash a uid into [0, 100) for percentage-based rollouts. */
function rolloutBucket(uid: string): number {
  // FNV-1a 32-bit hash, modulo 100. Stable across deploys, no crypto needed.
  let h = 0x811c9dc5
  for (let i = 0; i < uid.length; i++) {
    h ^= uid.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) % 100
}

/** Match one segment predicate against a context. */
function matches(segment: string, ctx: FlagContext): boolean {
  // Recognized segment shapes:
  //   tier:pro          → ctx.tier === 'pro'
  //   country:IN        → ctx.country === 'IN'
  //   app:oriz-omni     → ctx.app === 'oriz-omni'
  //   rollout:5         → rolloutBucket(uid) < 5 (anon uids → no match)
  //   uid:abc123        → ctx.uid === 'abc123'
  //   all               → always true (default rule)
  if (segment === 'all') return true
  const [type, value] = segment.split(':', 2)
  if (!type || !value) return false
  if (type === 'tier') return ctx.tier === value
  if (type === 'country') return ctx.country === value
  if (type === 'app') return ctx.app === value
  if (type === 'uid') return ctx.uid === value
  if (type === 'rollout') {
    if (!ctx.uid) return false
    const pct = Number(value)
    if (!Number.isFinite(pct)) return false
    return rolloutBucket(ctx.uid) < pct
  }
  return false
}

/** Evaluate one flag against the context, returning the first matching variant. */
function evaluate(
  flagKey: string,
  tree: FlagTree,
  ctx: FlagContext,
): string | boolean | number | undefined {
  const f = tree.flags[flagKey]
  if (!f) return undefined
  // Rules already sorted by priority server-side, but sort defensively.
  const sorted = [...f.rules].sort((a, b) => a.priority - b.priority)
  for (const rule of sorted) {
    if (matches(rule.segment, ctx)) return rule.variant
  }
  return f.default
}

/**
 * Resolve flags for one request. Call once per page render in Astro frontmatter.
 *
 * Returns an object with `.bool()`, `.str()`, `.num()` accessors. Each accessor
 * takes a flag key + default value and returns the resolved variant. If the
 * flag service is unreachable, every accessor returns its default.
 */
export async function flags(ctx: FlagContext = {}) {
  const tree = await fetchTree()
  return {
    /** True if the flag exists and resolves truthy; otherwise `defaultValue`. */
    bool(key: string, defaultValue: boolean): boolean {
      if (!tree) return defaultValue
      const v = evaluate(key, tree, ctx)
      if (v === undefined) return defaultValue
      return Boolean(v)
    },
    /** String variant of a flag; otherwise `defaultValue`. */
    str(key: string, defaultValue: string): string {
      if (!tree) return defaultValue
      const v = evaluate(key, tree, ctx)
      if (v === undefined) return defaultValue
      return String(v)
    },
    /** Numeric variant of a flag; otherwise `defaultValue`. */
    num(key: string, defaultValue: number): number {
      if (!tree) return defaultValue
      const v = evaluate(key, tree, ctx)
      if (v === undefined) return defaultValue
      const n = typeof v === 'number' ? v : Number(v)
      return Number.isFinite(n) ? n : defaultValue
    },
    /** True iff the flag service answered (vs. timed out → all defaults). */
    isLive(): boolean {
      return tree !== null
    },
  }
}

/** For tests + the admin UI smoke check — clears the per-isolate cache. */
export function __clearCache(): void {
  cachedTree = null
  cachedAt = 0
}
