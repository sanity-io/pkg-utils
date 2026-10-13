import {mkdtempSync, writeFileSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import murmurHash from '@emotion/hash'
import {describe, expect, test} from 'vitest'
import {resolveIdentifierOption} from '../src/identifiers.ts'
import {processVanillaFile} from '../src/processVanillaFile.ts'
import {transform} from '../src/transform.ts'
import type {IdentifierOption, PluginIdentifierOption} from '../src/types.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const integrationRoot = path.resolve(__dirname, '..')
// The path doesn't need to exist: it only anchors require() resolution for the sandbox
const filePath = path.join(integrationRoot, 'test/fixtures/button.css.js')

/** A package root whose `package.json` declares `@sanity/ui` at `version`. */
function packageRoot(version?: string): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'safe-identifiers-'))
  writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({name: '@sanity/ui', ...(version ? {version} : {})}),
  )
  return root
}

function expectFunction(identOption: IdentifierOption): Exclude<IdentifierOption, string> {
  if (typeof identOption !== 'function') expect.unreachable('expected a custom identifier function')
  return identOption
}

const loadingBox = `style({ position: 'absolute', inset: 0, zIndex: 1, background: 'var(--card-bg-color)' })`

/** `@sanity/ui` 4.4.2's `button.css.ts`: the loading overlay is the module's first style. */
const overlayFirst = `const { style } = require('@vanilla-extract/css');
exports.buttonLoadingBox = ${loadingBox};`

/** `@sanity/ui` 4.4.4's `button.css.ts`: a root style is declared before the overlay. */
const rootFirst = `const { style } = require('@vanilla-extract/css');
exports.buttonRoot = style({ position: 'relative', display: 'inline-flex' });
exports.buttonLoadingBox = ${loadingBox};`

/** Compiles one release of the module like the plugins do, returning its exported classes. */
async function buildRelease(
  source: string,
  version: string,
  identifiers: PluginIdentifierOption,
): Promise<Map<string, string>> {
  const identOption = resolveIdentifierOption(identifiers, packageRoot(version))
  const compiled = await transform({
    source,
    filePath,
    rootPath: integrationRoot,
    packageName: '@sanity/ui',
    identOption,
  })
  const output = await processVanillaFile({source: compiled, filePath, identOption})
  return new Map(
    Array.from(output.matchAll(/export var (\w+) = ['"]([^'"]+)['"];/g), ([, name, className]) => [
      name!,
      className!,
    ]),
  )
}

function sharedClassNames(a: Map<string, string>, b: Map<string, string>): string[] {
  const classNames = new Set(b.values())
  return [...a.values()].filter((className) => classNames.has(className))
}

const custom: IdentifierOption = ({hash}) => `custom_${hash}`

describe('resolveIdentifierOption', () => {
  test('passes `short`, `debug` and custom identifier functions through', () => {
    // Without `'safe'` there's nothing to look up, so not even a package.json is needed
    const noPackage = mkdtempSync(path.join(os.tmpdir(), 'no-package-'))

    expect(resolveIdentifierOption('short', noPackage)).toBe('short')
    expect(resolveIdentifierOption('debug', noPackage)).toBe('debug')
    expect(resolveIdentifierOption(custom, noPackage)).toBe(custom)
  })

  test("`'safe'` is `'short'` with the package version in the file-scope hash", () => {
    const safe = expectFunction(resolveIdentifierOption('safe', packageRoot('4.4.4')))
    const buttonCssTs = 'src/core/primitives/button/button.css.ts'
    // The `'short'` identifiers of the incident: `_2mi48t0` is `@emotion/hash` of the package
    // name and file path, then the base-36 counter of the identifiers generated so far
    const shortHash = murmurHash(`@sanity/ui${buttonCssTs}`)
    expect(shortHash).toBe('2mi48t')

    const safeHash = murmurHash(`@sanity/ui@4.4.4${buttonCssTs}`)
    for (const counter of ['0', '2', 'a', '1z']) {
      const expected = `${safeHash}${counter}`
      expect(
        safe({hash: `${shortHash}${counter}`, filePath: buttonCssTs, packageName: '@sanity/ui'}),
      ).toBe(/^[0-9]/.test(expected) ? `_${expected}` : expected)
    }
  })

  test("`'safe'` ignores debug IDs, like `'short'`", () => {
    const safe = expectFunction(resolveIdentifierOption('safe', packageRoot('4.4.4')))
    const params = {hash: `${murmurHash('@sanity/uisrc/a.css.ts')}0`, filePath: 'src/a.css.ts'}

    expect(safe({...params, packageName: '@sanity/ui', debugId: 'root'})).toBe(
      safe({...params, packageName: '@sanity/ui'}),
    )
  })

  test("`'safe'` requires a package version", () => {
    expect(() => resolveIdentifierOption('safe', packageRoot())).toThrow(/has no `version`/)
  })
})

describe("`'safe'` identifiers across releases", () => {
  test('the same module gets different class names at two versions', async () => {
    const previous = await buildRelease(rootFirst, '4.4.3', 'safe')
    const next = await buildRelease(rootFirst, '4.4.4', 'safe')

    expect(sharedClassNames(previous, next)).toEqual([])
  })

  test('the same module keeps its class names within a version', async () => {
    const first = await buildRelease(rootFirst, '4.4.4', 'safe')
    const second = await buildRelease(rootFirst, '4.4.4', 'safe')

    expect(second).toEqual(first)
    // Shaped like `'short'` identifiers: a bare hash and the counter
    for (const className of first.values()) {
      expect(className).toMatch(/^_?[0-9a-z]+$/)
    }
  })

  test('releases that reorder styles never share a class name', async () => {
    // With the default `'short'` identifiers, both releases name their first style
    // `<hash of package + path>0`: 4.4.2's loading overlay is 4.4.4's root, so wherever both
    // releases' CSS is on one page, the old overlay rule covers every new Button
    const shortPrevious = await buildRelease(overlayFirst, '4.4.2', 'short')
    const shortNext = await buildRelease(rootFirst, '4.4.4', 'short')
    expect(shortNext.get('buttonRoot')).toBe(shortPrevious.get('buttonLoadingBox'))

    const safePrevious = await buildRelease(overlayFirst, '4.4.2', 'safe')
    const safeNext = await buildRelease(rootFirst, '4.4.4', 'safe')
    expect(sharedClassNames(safePrevious, safeNext)).toEqual([])
  })
})
