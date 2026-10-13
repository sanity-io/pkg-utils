import {mkdir, rm, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import type {IdentifierOption} from '@sanity/vanilla-extract-integration'
import {afterEach, describe, expect, test} from 'vitest'
import {createCompiler, type Compiler} from '../src/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const generatedRoot = path.resolve(__dirname, 'fixtures/generated')

/**
 * The compiler qualifies every `.css.ts` module's file scope with the app's package version
 * and a digest of the module source (see `createFileScopePackageName` in
 * `@sanity/vanilla-extract-integration`), so the identifiers of two builds with different
 * versions or styles never collide — the SAPP-4639 regression, where the CSS of one
 * `@sanity/ui` version styled the markup of another because both used the same class names.
 * The library builds are covered by the integration package; these tests cover the Vite
 * compiler, which `sanity`'s module CDN bundle is built with.
 */

const stylesV1 = `import {style} from '@vanilla-extract/css'

export const overlay: string = style({
  position: 'absolute',
  inset: 0,
})

export const root: string = style({
  display: 'inline-flex',
})
`

const stylesV2 = `import {style} from '@vanilla-extract/css'

export const root: string = style({
  display: 'inline-flex',
})

export const overlay: string = style({
  position: 'absolute',
  inset: 0,
})
`

interface FixtureApp {
  name: string
  version?: string
  styles: string
}

/** (Re-)generates an app root under `fixtures/generated/<slug>` and returns it. */
async function writeApp(slug: string, {name, version, styles}: FixtureApp): Promise<string> {
  const root = path.join(generatedRoot, slug)
  await rm(root, {recursive: true, force: true})
  await mkdir(path.join(root, 'src'), {recursive: true})
  await writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({name, ...(version === undefined ? {} : {version}), type: 'module'}),
  )
  await writeFile(path.join(root, 'src/styles.css.ts'), styles)
  return root
}

const compilersToClose: Compiler[] = []
afterEach(async () => {
  await Promise.all(compilersToClose.splice(0).map((compiler) => compiler.close()))
})

/** Compiles `src/styles.css.ts` of an app root, returning its exports and extracted CSS. */
async function compileStyles(
  root: string,
  identifiers: IdentifierOption = 'short',
): Promise<{exports: Record<string, string>; css: string}> {
  const compiler = createCompiler({root, identifiers, enableFileWatcher: false})
  compilersToClose.push(compiler)
  const filePath = path.join(root, 'src/styles.css.ts')
  const {source} = await compiler.processVanillaFile(filePath)

  const exports: Record<string, string> = {}
  for (const match of source.matchAll(/^export var (\w+) = (["'])(.*)\2;$/gm)) {
    exports[match[1]!] = match[3]!
  }
  return {exports, css: compiler.getCssForFile(filePath)?.css ?? ''}
}

describe('identifiers', () => {
  test('are deterministic for the same name, version and source', async () => {
    const app: FixtureApp = {name: 'studio', version: '1.0.0', styles: stylesV1}
    const first = await compileStyles(await writeApp('deterministic-a', app))
    const second = await compileStyles(await writeApp('deterministic-b', app))

    expect(second).toEqual(first)
    expect(first.exports['overlay']).toMatch(/^_?[0-9a-z]{1,7}0$/)
    expect(first.exports['root']).toMatch(/^_?[0-9a-z]{1,7}1$/)
  })

  test('differ between two versions of an app with identical styles', async () => {
    const v1 = await compileStyles(
      await writeApp('version-1', {name: 'studio', version: '1.0.0', styles: stylesV1}),
    )
    const v2 = await compileStyles(
      await writeApp('version-2', {name: 'studio', version: '2.0.0', styles: stylesV1}),
    )

    for (const className of Object.values(v2.exports)) {
      expect(Object.values(v1.exports), `${className} is reused by both versions`).not.toContain(
        className,
      )
    }
  })

  test('differ when the styles change, so a renumbered class never inherits old rules', async () => {
    const before = await compileStyles(
      await writeApp('content-before', {name: 'studio', version: '1.0.0', styles: stylesV1}),
    )
    const after = await compileStyles(
      await writeApp('content-after', {name: 'studio', version: '1.0.0', styles: stylesV2}),
    )

    // Without the fix `root` takes over the class name (and, from a stale stylesheet, the
    // rules) of the old `overlay`
    expect(after.exports['root']).not.toBe(before.exports['overlay'])
    for (const className of Object.values(after.exports)) {
      expect(Object.values(before.exports), `${className} is reused by both builds`).not.toContain(
        className,
      )
    }
  })

  test('hand custom identifier functions the bare package name', async () => {
    const root = await writeApp('bare-package-name', {
      name: '@acme/studio',
      version: '1.0.0',
      styles: stylesV1,
    })
    const packageNames = new Set<string | undefined>()

    const {exports, css} = await compileStyles(root, ({hash, packageName}) => {
      packageNames.add(packageName)
      return `acme_${hash}`
    })

    expect([...packageNames]).toEqual(['@acme/studio'])
    expect(exports['overlay']).toMatch(/^acme_[0-9a-z]+0$/)
    expect(css).toContain(`.${exports['overlay']}`)
  })
})
