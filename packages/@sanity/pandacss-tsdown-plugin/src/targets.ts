import browserslist from 'browserslist'
import {browserslistToTargets, type Targets} from 'lightningcss'

const ES_VERSION_TARGET_RE = /^es(?:\d+|next)$/i
const ESBUILD_TARGET_RE = /^(chrome|edge|firefox|ie|ios|node|opera|safari)(\d+(?:\.\d+)*)$/i

const ENGINE_TO_BROWSERSLIST: Record<string, string | null> = {
  chrome: 'Chrome',
  edge: 'Edge',
  firefox: 'Firefox',
  ie: 'IE',
  ios: 'iOS',
  opera: 'Opera',
  safari: 'Safari',
  // Node is not a CSS engine — ignore it when converting mixed JS/CSS target arrays.
  node: null,
}

/**
 * Convert an esbuild/tsdown `target` value (e.g. `'chrome120'` or
 * `['chrome102', 'firefox91', 'safari16.4', 'node22']`) or a browserslist query
 * (e.g. `'defaults'`, `'> 0.5%'`) to LightningCSS browser `targets`.
 *
 * Returns `undefined` when `target` is `false`, `'esnext'`, or contains only
 * non-browser engines (such as `'node22'`) or generic ES version strings
 * (`'es2022'`), in which case LightningCSS performs no syntax downleveling.
 *
 * @public
 */
export function esbuildTargetToLightningCSS(
  target: string | readonly string[] | false | undefined,
): Targets | undefined {
  if (!target) return undefined

  const items = typeof target === 'string' ? [target] : target
  const queries: string[] = []

  for (const raw of items) {
    const item = raw.trim().toLowerCase()
    if (!item || ES_VERSION_TARGET_RE.test(item)) {
      continue
    }
    const match = ESBUILD_TARGET_RE.exec(item)
    if (match) {
      const browser = ENGINE_TO_BROWSERSLIST[match[1]!]
      if (browser) {
        queries.push(`${browser} ${match[2]}`)
      }
      continue
    }
    // Fall back to treating the string as a raw browserslist query (e.g. 'defaults', '> 0.5%').
    queries.push(raw)
  }

  if (queries.length === 0) return undefined

  return browserslistToTargets(browserslist(queries))
}
