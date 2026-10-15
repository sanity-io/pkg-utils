import browserslistConfig from '@sanity/browserslist-config'
import browserslist from 'browserslist'
import {browserslistToTargets} from 'lightningcss'
import {describe, expect, test} from 'vitest'
import {resolveCssLoweringTargets} from '../src/cssLoweringTargets.ts'

const sanityTargets = browserslistToTargets(browserslist(browserslistConfig))

describe('resolveCssLoweringTargets', () => {
  test('leaves esbuild-style browser targets to the pipeline', async () => {
    // The pipeline converts `chrome61` itself (like `@tsdown/css`), so no fallback applies
    await expect(
      resolveCssLoweringTargets({
        cssTarget: 'chrome61',
        target: undefined,
        lightningcss: undefined,
      }),
    ).resolves.toBeUndefined()
    await expect(
      resolveCssLoweringTargets({
        cssTarget: undefined,
        target: ['chrome61', 'node20'],
        lightningcss: {},
      }),
    ).resolves.toEqual({})
  })

  test('resolves browserslist queries instead of overriding them with the fallback', async () => {
    // `'defaults'` or `'> 0.5%'` are not esbuild-style, but they do name browsers: the
    // requested browsers are what the CSS is transformed for, not the Sanity browserslist config
    await expect(
      resolveCssLoweringTargets({cssTarget: 'defaults', target: 'node20', lightningcss: undefined}),
    ).resolves.toEqual({targets: browserslistToTargets(browserslist('defaults'))})
    // The other `lightningcss` options are kept
    const lightningcss: {targets?: undefined; unusedSymbols: string[]} = {unusedSymbols: ['--x']}
    await expect(
      resolveCssLoweringTargets({
        cssTarget: ['> 0.5%', 'last 2 versions'],
        target: undefined,
        lightningcss,
      }),
    ).resolves.toEqual({
      unusedSymbols: ['--x'],
      targets: browserslistToTargets(browserslist(['> 0.5%', 'last 2 versions'])),
    })
    expect(browserslistToTargets(browserslist('defaults'))).not.toEqual(sanityTargets)
  })

  test('falls back to @sanity/browserslist-config for targets that name no browsers', async () => {
    for (const cssTarget of ['node20', 'es2022', 'node 20', ['node20', 'es2022']]) {
      await expect(
        resolveCssLoweringTargets({cssTarget, target: undefined, lightningcss: undefined}),
      ).resolves.toEqual({targets: sanityTargets})
    }
    await expect(
      resolveCssLoweringTargets({cssTarget: undefined, target: undefined, lightningcss: undefined}),
    ).resolves.toEqual({targets: sanityTargets})
  })

  test('explicit `lightningcss.targets` and `target: false` win over everything', async () => {
    const lightningcss = {targets: {chrome: 61 << 16}}
    await expect(
      resolveCssLoweringTargets({cssTarget: 'defaults', target: undefined, lightningcss}),
    ).resolves.toBe(lightningcss)
    await expect(
      resolveCssLoweringTargets({cssTarget: false, target: 'node20', lightningcss: undefined}),
    ).resolves.toBeUndefined()
  })
})
