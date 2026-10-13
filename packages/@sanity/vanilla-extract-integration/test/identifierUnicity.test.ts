import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {describe, expect, test} from 'vitest'
import {compile} from '../src/compile.ts'
import {getSourceFromVirtualCssFile} from '../src/getSourceFromVirtualCssFile.ts'
import {processVanillaFile} from '../src/processVanillaFile.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const unicityDir = path.join(__dirname, 'fixtures/unicity')

interface BuiltFixture {
  exports: Record<string, string>
  css: string
}

/** Builds a versioned fixture exactly like the rolldown plugin does. */
async function buildFixture(fixture: string): Promise<BuiltFixture> {
  const cwd = path.join(unicityDir, fixture)
  const filePath = path.join(cwd, 'button.css.ts')
  const {source} = await compile({filePath, cwd, identOption: 'short'})
  const output = await processVanillaFile({source, filePath, identOption: 'short'})

  const exports: Record<string, string> = {}
  for (const match of output.matchAll(/export var (\w+) = '([^']+)';/g)) {
    exports[match[1]!] = match[2]!
  }
  const cssParts: string[] = []
  for (const match of output.matchAll(/import '([^']+\.vanilla\.css[^']*)';/g)) {
    const {source: css} = await getSourceFromVirtualCssFile(match[1]!)
    cssParts.push(css)
  }
  return {exports, css: cssParts.join('\n')}
}

function classNames(fixture: BuiltFixture): string[] {
  return Object.values(fixture.exports)
}

describe('identifier unicity (SAPP-4639)', () => {
  test('different package versions produce different class names for identical content', async () => {
    const [v1, v2] = await Promise.all([
      buildFixture('same-content-v1'),
      buildFixture('same-content-v2'),
    ])

    // Same exports, byte-identical styles — but the versions differ, so no class name may
    // be shared: old CSS must never style new markup when both versions share a page
    expect(Object.keys(v1.exports).toSorted()).toEqual(['overlay', 'root'])
    expect(Object.keys(v2.exports).toSorted()).toEqual(['overlay', 'root'])
    expect(classNames(v1).filter((className) => classNames(v2).includes(className))).toEqual([])
  })

  test('different style content produces different class names for the same version', async () => {
    const [v1, v2] = await Promise.all([
      buildFixture('renumbered-v1'),
      buildFixture('renumbered-v2'),
    ])

    // The v2 file reordered the styles and added one (the `@sanity/ui` 4.4.3 → 4.4.4 shape):
    // the old overlay class must not be reused for a different rule
    expect(v1.exports['overlay']).toBeDefined()
    expect(v2.css).not.toContain(`.${v1.exports['overlay']}`)
    expect(classNames(v2)).not.toContain(v1.exports['overlay'])
    expect(classNames(v1).filter((className) => classNames(v2).includes(className))).toEqual([])

    // And each build is still self-consistent: every export has its own rule
    for (const [name, className] of Object.entries(v2.exports)) {
      expect(v2.css, `expected a CSS rule for ${name} (.${className})`).toContain(`.${className}`)
    }
  })

  test('identical input produces identical class names', async () => {
    const [first, second] = await Promise.all([
      buildFixture('same-content-v1'),
      buildFixture('same-content-v1'),
    ])

    expect(second.exports).toEqual(first.exports)
    expect(second.css).toBe(first.css)
  })

  test('class names stay short', async () => {
    const fixture = await buildFixture('same-content-v1')

    // The salt feeds the file-scope hash input, not the output: `short` names keep their
    // bare-hash shape (underscore-prefixed when starting with a digit)
    for (const className of classNames(fixture)) {
      expect(className).toMatch(/^_?[a-z0-9]+$/i)
      expect(className.length).toBeLessThanOrEqual(10)
    }
  })
})
