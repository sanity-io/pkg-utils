/**
 * Differential test for the vendored renderer: for every `.css.ts` fixture in the repository
 * (and the generated benchmark corpus when present), the vendored `transformCss` must produce
 * byte-identical CSS and the same composition-usage marks as upstream
 * `@vanilla-extract/css/transformCss`.
 */
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {removeAdapter, setAdapter} from '@vanilla-extract/css/adapter'
import {transformCss as upstreamTransformCss} from '@vanilla-extract/css/transformCss'
import {describe, expect, test} from 'vitest'
import {compile} from '../src/compile.ts'
import {evaluateVanillaModule} from '../src/evaluateVanillaModule.ts'
import {getPackageInfo} from '../src/packageInfo.ts'
import {transformCss} from '../src/transformCss/transformCss.ts'
import type {IdentifierOption} from '../src/types.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../../..')

function collectCssModules(directory: string): string[] {
  if (!fs.existsSync(directory)) return []
  const files: string[] = []
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectCssModules(entryPath))
    } else if (/\.css\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
      files.push(entryPath)
    }
  }
  return files.toSorted()
}

const repositoryFixtures = [
  path.join(__dirname, 'fixtures'),
  path.join(repoRoot, 'packages/@sanity/vanilla-extract-rolldown-plugin/test/fixtures'),
  path.join(repoRoot, 'packages/@sanity/vanilla-extract-tsdown-plugin/test/fixtures'),
  path.join(repoRoot, 'packages/@sanity/vanilla-extract-vite-plugin/test/fixtures/app'),
  path.join(repoRoot, 'integration/vanilla-extract-studio/src'),
  path.join(repoRoot, 'css-playground/sanity-css-vanilla-extract-test/src'),
].flatMap(collectCssModules)

/**
 * The production-shaped benchmark corpus (`pnpm --filter @benchmarks/vanilla-extract
 * benchmark:prepare`), sampled when it has been generated.
 */
const benchmarkCorpus = collectCssModules(
  path.join(repoRoot, 'benchmarks/vanilla-extract/.generated/representative/src/styles'),
).filter((_, index) => index % 10 === 0)

const identOptions: IdentifierOption[] = ['short', 'debug']

async function renderBothWays(filePath: string, identOption: IdentifierOption) {
  const cwd = getPackageInfo(path.dirname(filePath)).dirname
  const {source} = await compile({filePath, cwd, identOption})
  const {cssByFileScope, localClassNames, composedClassLists} = evaluateVanillaModule({
    source,
    filePath,
    identOption,
  })

  const results: Array<{
    fileScope: string
    upstream: {css: string[]; used: string[]}
    vendored: {css: string[]; used: string[]}
  }> = []

  for (const [fileScope, cssObjs] of cssByFileScope) {
    const upstreamUsed = new Set<string>()
    setAdapter({
      appendCss: () => {},
      registerClassName: () => {},
      registerComposition: () => {},
      markCompositionUsed: (identifier) => {
        upstreamUsed.add(identifier)
      },
      onEndFileScope: () => {},
      getIdentOption: () => identOption,
    })
    let upstreamCss: string[]
    try {
      // Both renderers mutate the CSS objects they're given (pixelify, keyframes), so each gets
      // its own copy
      upstreamCss = upstreamTransformCss({
        localClassNames: Array.from(localClassNames),
        composedClassLists,
        cssObjs: structuredClone(cssObjs),
      })
    } finally {
      removeAdapter()
    }

    const vendoredUsed = new Set<string>()
    const vendoredCss = transformCss({
      localClassNames: Array.from(localClassNames),
      composedClassLists,
      cssObjs: structuredClone(cssObjs),
      onCompositionUsed: (identifier) => {
        vendoredUsed.add(identifier)
      },
    })

    results.push({
      fileScope,
      upstream: {css: upstreamCss, used: [...upstreamUsed].toSorted()},
      vendored: {css: vendoredCss, used: [...vendoredUsed].toSorted()},
    })
  }

  return results
}

describe('vendored transformCss', () => {
  test('the fixture corpus covers every renderer feature', () => {
    expect(repositoryFixtures.length).toBeGreaterThanOrEqual(10)
    const kitchenSink = fs.readFileSync(
      path.join(__dirname, 'fixtures/kitchen-sink/styles.css.ts'),
      'utf8',
    )
    for (const feature of [
      "'@media'",
      "'@supports'",
      "'@container'",
      "'@layer'",
      "'@scope'",
      "'@starting-style'",
      'selectors',
      "':hover'",
      "'::before'",
      'vars:',
      'content:',
      'styleVariants',
      'globalStyle',
    ]) {
      expect(kitchenSink).toContain(feature)
    }
  })

  describe.each(identOptions)(
    'renders byte-identical CSS to upstream (%s identifiers)',
    (identOption) => {
      test.each(repositoryFixtures)('%s', async (filePath) => {
        const results = await renderBothWays(filePath, identOption)
        expect(results.length).toBeGreaterThan(0)

        for (const {fileScope, upstream, vendored} of results) {
          expect(vendored.css, fileScope).toEqual(upstream.css)
          expect(vendored.used, fileScope).toEqual(upstream.used)
        }
      })
    },
  )

  describe.skipIf(benchmarkCorpus.length === 0)('benchmark corpus', () => {
    test.each(benchmarkCorpus)('%s', async (filePath) => {
      const results = await renderBothWays(filePath, 'short')
      for (const {fileScope, upstream, vendored} of results) {
        expect(vendored.css, fileScope).toEqual(upstream.css)
      }
    })
  })
})
