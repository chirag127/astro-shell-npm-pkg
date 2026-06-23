// @chirag127/astro-shell/auth-gate
//
// Cross-domain auth helper for the oriz family. Each app's chrome calls these
// helpers to (a) read the central auth state shared across *.oriz.in and (b)
// render a sign-in CTA that bounces the user to https://account.oriz.in/sign-in
// with a `return` URL so the central auth surface can complete the round-trip.
//
// Design notes:
//   • No framework deps — these are plain functions. Apps can call them from
//     a React island, an Astro component, or a vanilla <script>.
//   • Cookie is read-only here. Issuing/refreshing `oriz_auth` is the central
//     auth app's job (so the private signing key never leaves auth.oriz.in).
//   • SSR-safe: every helper guards on `typeof window`/`document` so it can
//     be imported from .astro components without exploding at build time.
//   • The shape returned by `readAuthCookie()` is deliberately permissive —
//     central auth controls the schema; consumers only need `email` /
//     `displayName` / `photoURL` to render a chrome.

/** Central auth surface origin. Single source of truth. */
export const AUTH_ORIGIN = 'https://account.oriz.in'

/** Cookie name set on `.oriz.in` by the central auth app after sign-in. */
export const AUTH_COOKIE = 'oriz_auth'

/** Subset of fields the chrome needs. Central auth may include more. */
export interface OrizAuthUser {
  uid?: string
  email?: string
  displayName?: string
  photoURL?: string
  /** Unix seconds. Consumers should ignore the cookie if expired. */
  exp?: number
}

/**
 * Read the central auth cookie and return the decoded user, or `null` if not
 * signed in / expired / unparseable. SSR-safe.
 *
 * The cookie value is expected to be a URL-encoded JSON blob written by the
 * central auth app on `.oriz.in` scope. Apps under any `*.oriz.in` host can
 * read it (assuming HTTPS + Secure flag).
 */
export function readAuthCookie(): OrizAuthUser | null {
  if (typeof document === 'undefined') return null
  const raw = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${AUTH_COOKIE}=`))
  if (!raw) return null
  try {
    const value = decodeURIComponent(raw.slice(AUTH_COOKIE.length + 1))
    const user = JSON.parse(value) as OrizAuthUser
    if (user.exp && user.exp * 1000 < Date.now()) return null
    return user
  } catch {
    return null
  }
}

/**
 * Build the central sign-in URL with a `return` query param so the user
 * lands back on the page they came from after completing auth.
 *
 * @param returnUrl Absolute or relative URL to return to. Defaults to the
 *   current `window.location.href` when called in a browser context.
 */
export function signInUrl(returnUrl?: string): string {
  let target = returnUrl
  if (!target && typeof window !== 'undefined') target = window.location.href
  const ret = target ? `?return=${encodeURIComponent(target)}` : ''
  return `${AUTH_ORIGIN}/sign-in${ret}`
}

/**
 * Build the central sign-out URL. Central auth clears the cookie and bounces
 * the user back to `returnUrl`.
 */
export function signOutUrl(returnUrl?: string): string {
  let target = returnUrl
  if (!target && typeof window !== 'undefined') target = window.location.href
  const ret = target ? `?return=${encodeURIComponent(target)}` : ''
  return `${AUTH_ORIGIN}/sign-out${ret}`
}

/**
 * Hydration script that wires a chrome's "Sign in" button + avatar slot.
 *
 * Apps inline this string in their <head> via `<script set:html={authGateInit()}>`
 * so the chrome reflects auth state on first paint without waiting for a
 * framework bundle. Each element is selected by a `data-auth-*` attribute:
 *
 *   • `[data-auth-signed-in]` — shown when signed in (display:'' on match).
 *   • `[data-auth-signed-out]` — shown when signed out (display:'' on match).
 *   • `[data-auth-name]`      — innerText set to user.displayName or email.
 *   • `[data-auth-email]`     — innerText set to user.email.
 *   • `[data-auth-avatar]`    — src set to user.photoURL (if <img>).
 *   • `[data-auth-signin]`    — href set to signInUrl(location.href).
 *   • `[data-auth-signout]`   — href set to signOutUrl(location.href).
 *
 * The function returns a self-contained IIFE string. No imports, no globals,
 * safe to inline even with strict CSP if a nonce is attached.
 */
export function authGateInit(): string {
  // Keep this inline string tiny — it ships in every app's <head>.
  return `(function(){
    var COOKIE='${AUTH_COOKIE}';
    var ORIGIN='${AUTH_ORIGIN}';
    function read(){
      try{
        var row=document.cookie.split('; ').find(function(r){return r.indexOf(COOKIE+'=')===0});
        if(!row) return null;
        var u=JSON.parse(decodeURIComponent(row.slice(COOKIE.length+1)));
        if(u.exp && u.exp*1000<Date.now()) return null;
        return u;
      }catch(e){return null}
    }
    function apply(){
      var u=read();
      var here=encodeURIComponent(location.href);
      document.querySelectorAll('[data-auth-signed-in]').forEach(function(el){el.hidden=!u});
      document.querySelectorAll('[data-auth-signed-out]').forEach(function(el){el.hidden=!!u});
      if(u){
        document.querySelectorAll('[data-auth-name]').forEach(function(el){el.textContent=u.displayName||u.email||''});
        document.querySelectorAll('[data-auth-email]').forEach(function(el){el.textContent=u.email||''});
        document.querySelectorAll('[data-auth-avatar]').forEach(function(el){if(u.photoURL)el.setAttribute('src',u.photoURL)});
      }
      document.querySelectorAll('[data-auth-signin]').forEach(function(el){el.setAttribute('href',ORIGIN+'/sign-in?return='+here)});
      document.querySelectorAll('[data-auth-signout]').forEach(function(el){el.setAttribute('href',ORIGIN+'/sign-out?return='+here)});
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);else apply();
  })();`
}
