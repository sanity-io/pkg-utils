import {esbuildTargetToLightningCSS} from '@sanity/vanilla-extract-tsdown-plugin'
import type {Targets} from 'lightningcss'
import {expandBaselineTarget, resolveComma, toArray} from 'tsdown/internal'

/** tsdown's alias for the browsers of Baseline Widely available, which it expands itself. */
const BASELINE_WIDELY_AVAILABLE = 'baseline-widely-available'

/** The `lightningcss` options both CSS pipelines accept, narrowed to what this helper touches. */
interface LightningCSSOptionsWithTargets {
  targets?: Targets | undefined
}

/**
 * Resolves the CSS syntax lowering targets for a CSS pipeline
 * (`vanillaExtract`/`panda`/`css`), applying the Sanity-flavored fallback on top of the
 * `@tsdown/css` behavior the pipelines otherwise follow.
 *
 * `@tsdown/css` skips syntax lowering when it has no browser targets. Extracted CSS always runs
 * in browsers though, so when the effective target (the pipeline's own `target`, falling back to
 * the top-level `target`) is undefined or names no browsers - e.g. `'node20'`, which is also
 * what tsdown derives from `engines.node` and speaks to the JS runtime - the lowering targets
 * are resolved from `@sanity/browserslist-config` and passed through `lightningcss.targets`
 * instead.
 *
 * tsdown's `'baseline-widely-available'` alias resolves to the browsers tsdown expands it to. A
 * target that isn't esbuild-style but is a browserslist query (`'defaults'`, `'> 0.5%'`,
 * `'last 2 versions'`) is resolved with browserslist rather than overridden by that fallback.
 * `target: false` stays the explicit off switch, and a user-provided `lightningcss.targets`
 * wins over everything.
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
}): Promise<LightningCSSOptionsWithTargets | undefined> {
  const {target, lightningcss} = options
  const cssTarget = options.cssTarget ?? target

  if (cssTarget === false || lightningcss?.targets) return lightningcss
  if (cssTarget !== undefined) {
    // tsdown's `baseline-widely-available` alias names browsers once expanded, like tsdown and
    // `@tsdown/css` expand it. The pipelines convert their own `target` without expanding it,
    // so an expanded alias is handed to them as explicit targets.
    const parts = resolveComma(toArray(cssTarget))
    const browsers = esbuildTargetToLightningCSS(expandBaselineTarget(parts))
    if (browsers) {
      return parts.includes(BASELINE_WIDELY_AVAILABLE)
        ? {...lightningcss, targets: browsers}
        : lightningcss
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

  if (cssTarget !== undefined) {
    // A target that isn't esbuild-style may be browserslist queries (`'defaults'`,
    // `'> 0.5%'`): the browsers they name are what the CSS is lowered for, not the fallback.
    // browserslist throws for queries it doesn't know (`'node20'`, `'es2022'`), and
    // `'node 20'` resolves to no browser (`browserslistToTargets` keeps `node` as a target).
    try {
      const targets = browserslistToTargets(browserslist(cssTarget))
      if (Object.keys(targets).some((name) => name !== 'node')) return {...lightningcss, targets}
    } catch {
      // Not browserslist queries either: the fallback below applies
    }
  }
  return {
    ...lightningcss,
    targets: browserslistToTargets(browserslist(browserslistConfig)),
  }
}
