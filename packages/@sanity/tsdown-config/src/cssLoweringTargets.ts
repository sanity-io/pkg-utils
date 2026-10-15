import {esbuildTargetToLightningCSS} from '@sanity/vanilla-extract-tsdown-plugin'
import type {Targets} from 'lightningcss'

/** The `lightningcss` options both CSS pipelines accept, narrowed to what this helper touches. */
interface LightningCSSOptionsWithTargets {
  targets?: Targets | undefined
}

/**
 * Matches esbuild-style targets (`'chrome90'`, `'node20'`, `'es2022'`, `'esnext'`) and tsdown's
 * `'baseline-widely-available'`, which aren't browserslist queries.
 */
const RE_TSDOWN_TARGET = /^(?:[a-z]+\d+(?:\.\d+)*|esnext|baseline-widely-available)$/i

/** The browsers of lightningcss `Targets`. */
const BROWSERS = [
  'android',
  'chrome',
  'edge',
  'firefox',
  'ie',
  'ios_saf',
  'opera',
  'safari',
  'samsung',
] as const satisfies readonly (keyof Targets)[]

/**
 * Resolves the CSS syntax lowering targets for a CSS pipeline
 * (`vanillaExtract`/`css`/`panda`), applying the Sanity-flavored fallback on top of the
 * `@tsdown/css` behavior the pipelines otherwise follow.
 *
 * `@tsdown/css` skips syntax lowering when it has no browser targets. Extracted CSS always runs
 * in browsers though, so when the effective target (the pipeline's own `target`, falling back to
 * the top-level `target`) is undefined or names no browsers - e.g. `'node20'`, which is also
 * what tsdown derives from `engines.node` and speaks to the JS runtime - the lowering targets
 * are resolved from `@sanity/browserslist-config` and passed through `lightningcss.targets`
 * instead.
 *
 * With `browserslistQueries`, the targets that aren't esbuild-style (e.g. `'defaults'`,
 * `'> 0.5%'`) are browserslist queries, resolved here and passed through `lightningcss.targets`
 * as well, since the plugin only parses esbuild-style targets.
 *
 * `target: false` stays the explicit off switch, and a user-provided `lightningcss.targets`
 * wins over the fallback.
 *
 * @internal
 */
export async function resolveCssLoweringTargets(options: {
  /** The pipeline's own `target` option. */
  cssTarget: string | string[] | false | undefined
  /** tsdown's top-level `target`, the fallback for `cssTarget`. */
  target: string | string[] | false | undefined
  /** The pipeline's own `lightningcss` options. */
  lightningcss: LightningCSSOptionsWithTargets | undefined
  /** Whether `cssTarget` may hold browserslist queries, as `panda.target` does. */
  browserslistQueries?: boolean
}): Promise<LightningCSSOptionsWithTargets | undefined> {
  const {target, lightningcss} = options
  const cssTarget = options.cssTarget ?? target

  if (cssTarget === false || lightningcss?.targets) return lightningcss

  if (cssTarget !== undefined) {
    // Comma-separated like tsdown's own `target`, which is also how browserslist joins queries
    const parts = (Array.isArray(cssTarget) ? cssTarget : [cssTarget])
      .flatMap((entry) => entry.split(','))
      .map((part) => part.trim())
      .filter(Boolean)
    const queries = options.browserslistQueries
      ? parts.filter((part) => !RE_TSDOWN_TARGET.test(part))
      : []
    if (queries.length > 0) {
      const [{default: browserslist}, {browserslistToTargets}] = await Promise.all([
        import('browserslist'),
        import('lightningcss'),
      ])
      const targets = lowestVersions([
        browserslistToTargets(browserslist(queries)),
        ...parts
          .filter((part) => !queries.includes(part))
          .map((part) => esbuildTargetToLightningCSS(part)),
      ])
      if (targets) return {...lightningcss, targets}
    } else if (esbuildTargetToLightningCSS(cssTarget)) {
      return lightningcss
    }
  }

  // Lazy loaded: `browserslistToTargets` is a pure helper, but `lightningcss` is a native
  // package that only needs to load when the fallback applies
  const [{default: browserslist}, {default: browserslistConfig}, {browserslistToTargets}] =
    await Promise.all([
      import('browserslist'),
      import('@sanity/browserslist-config'),
      import('lightningcss'),
    ])
  return {
    ...lightningcss,
    targets: browserslistToTargets(browserslist(browserslistConfig)),
  }
}

/**
 * Merges the browsers of several targets, keeping the lowest version of each so the output
 * supports all of them. `undefined` when none of them name a browser.
 */
function lowestVersions(sources: (Targets | undefined)[]): Targets | undefined {
  let targets: Targets | undefined
  for (const source of sources) {
    if (!source) continue
    for (const browser of BROWSERS) {
      const version = source[browser]
      if (version === undefined) continue
      targets ??= {}
      const previous = targets[browser]
      targets[browser] = previous === undefined ? version : Math.min(previous, version)
    }
  }
  return targets
}
