import {mkdir, rm, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {rolldown} from 'rolldown'
import {describe, expect, test} from 'vitest'
import {vanillaExtractPlugin} from '../src/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const generatedRoot = path.resolve(__dirname, 'fixtures/generated')

/**
 * Library builds (tsdown through `@sanity/vanilla-extract-tsdown-plugin`, e.g. `@sanity/ui`)
 * compile each `.css.ts` module from the package's working directory, so the identifiers are
 * qualified with that package's name, version and the module source — the SAPP-4639
 * regression, where two `@sanity/ui` versions on one page shared class names with different
 * rules. The mechanics are covered in `@sanity/vanilla-extract-integration`; this verifies the
 * plugin's `cwd` build context feeds the right package into them.
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

interface FixtureLibrary {
  name: string
  version: string
  styles: string
}

/** (Re-)generates a library package under `fixtures/generated/<slug>` and returns its root. */
async function writeLibrary(slug: string, {name, version, styles}: FixtureLibrary) {
  const root = path.join(generatedRoot, slug)
  await rm(root, {recursive: true, force: true})
  await mkdir(path.join(root, 'src'), {recursive: true})
  await writeFile(path.join(root, 'package.json'), JSON.stringify({name, version, type: 'module'}))
  await writeFile(path.join(root, 'src/styles.css.ts'), styles)
  await writeFile(
    path.join(root, 'src/index.ts'),
    `export {overlay, root} from './styles.css.ts'\n`,
  )
  return root
}

/** Builds a library like a host would: the plugin's `cwd` build context is the package root. */
async function buildLibrary(root: string): Promise<{exports: Record<string, string>; css: string}> {
  const plugin = vanillaExtractPlugin()
  plugin.api.setBuildContext({cwd: root})
  const bundle = await rolldown({input: path.join(root, 'src/index.ts'), plugins: [plugin]})
  try {
    const {output} = await bundle.generate({format: 'esm'})
    const entry = output.find(
      (chunkOrAsset) => chunkOrAsset.type === 'chunk' && chunkOrAsset.isEntry,
    )
    const cssAsset = output.find((chunkOrAsset) => chunkOrAsset.fileName === 'bundle.css')
    if (entry?.type !== 'chunk' || cssAsset?.type !== 'asset') {
      expect.unreachable('expected an entry chunk and a bundle.css asset')
    }
    const exports: Record<string, string> = {}
    for (const match of entry.code.matchAll(/\b(overlay|root) = (["'])([^"']+)\2/g)) {
      exports[match[1]!] = match[3]!
    }
    expect(Object.keys(exports).toSorted()).toEqual(['overlay', 'root'])
    const {source} = cssAsset
    return {exports, css: typeof source === 'string' ? source : new TextDecoder().decode(source)}
  } finally {
    await bundle.close()
  }
}

describe('identifiers', () => {
  test('differ between two versions of a library with identical styles', async () => {
    const v1 = await buildLibrary(
      await writeLibrary('version-1', {name: '@acme/ui', version: '1.0.0', styles: stylesV1}),
    )
    const v2 = await buildLibrary(
      await writeLibrary('version-2', {name: '@acme/ui', version: '2.0.0', styles: stylesV1}),
    )

    expect(v1.css).toContain(`.${v1.exports['overlay']} {`)
    expect(v2.css).toContain(`.${v2.exports['overlay']} {`)
    for (const className of Object.values(v2.exports)) {
      expect(Object.values(v1.exports), `${className} is reused by both versions`).not.toContain(
        className,
      )
    }
  })

  test('differ when the styles of a version change, and stay the same when nothing does', async () => {
    const library: FixtureLibrary = {name: '@acme/ui', version: '1.0.0', styles: stylesV1}
    const before = await buildLibrary(await writeLibrary('content-before', library))
    const rebuilt = await buildLibrary(await writeLibrary('content-rebuilt', library))
    const after = await buildLibrary(
      await writeLibrary('content-after', {...library, styles: stylesV2}),
    )

    expect(rebuilt).toEqual(before)
    // Without the fix the new `root` takes over the old `overlay`'s class name — and, from a
    // stale stylesheet, its `position: absolute; inset: 0` rules
    expect(after.exports['root']).not.toBe(before.exports['overlay'])
    for (const className of Object.values(after.exports)) {
      expect(Object.values(before.exports), `${className} is reused by both builds`).not.toContain(
        className,
      )
    }
  })
})
