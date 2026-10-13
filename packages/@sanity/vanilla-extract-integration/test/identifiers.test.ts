import {mkdir, rm, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {describe, expect, test} from 'vitest'
import {compile} from '../src/compile.ts'
import {getSourceFromVirtualCssFile} from '../src/getSourceFromVirtualCssFile.ts'
import {processVanillaFile} from '../src/processVanillaFile.ts'
import type {IdentifierOption} from '../src/types.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const generatedRoot = path.join(__dirname, 'fixtures/generated')

/**
 * The regression behind these tests (sanity-io/sanity SAPP-4639): `@vanilla-extract/css`
 * derives identifiers from `hash(packageName + filePath)` plus a per-file counter, so with the
 * bare package name two versions of a package reuse the same class names — and once a style is
 * added or reordered, a class name selects a different rule in each version. When both
 * versions' CSS is on one page (an app bundling its own `@sanity/ui` next to a Studio loaded
 * from the module CDN), old CSS styles new markup: `_2mi48t0` was the Button's loading
 * overlay in `@sanity/ui` ≤ 4.4.2 and became its root class in 4.4.4.
 */

/** `@sanity/ui` ≤ 4.4.2 shaped `button.css.ts`: the loading overlay is the first `style()` call. */
const buttonV1 = `import {style} from '@vanilla-extract/css'

export const overlay: string = style({
  position: 'absolute',
  inset: 0,
  zIndex: 1,
  background: 'var(--card-bg-color)',
})

export const root: string = style({
  display: 'inline-flex',
  position: 'relative',
})
`

/** `@sanity/ui` 4.4.4 shaped `button.css.ts`: root first, a style added, the overlay now third. */
const buttonV2 = `import {style} from '@vanilla-extract/css'

export const root: string = style({
  display: 'inline-flex',
  position: 'relative',
})

export const loading: string = style({
  pointerEvents: 'none',
})

export const overlay: string = style({
  position: 'absolute',
  inset: 0,
  zIndex: 1,
  background: 'var(--card-bg-color)',
})
`

const themeCssTs = `import {createTheme} from '@vanilla-extract/css'

export const [themeClass, vars] = createTheme({
  space: '4px',
})
`

const entryCssTs = `import {style} from '@vanilla-extract/css'
import {themeClass, vars} from './theme.css.ts'

export const box: string = style({
  margin: vars.space,
  selectors: {
    [\`\${themeClass} &\`]: {
      color: 'rgb(4, 5, 6)',
    },
  },
})
`

interface FixturePackage {
  name: string
  version?: string
  /** Module sources keyed by path relative to the package's `src/` directory. */
  files: Record<string, string>
}

/** (Re-)generates a fixture package under `fixtures/generated/<slug>` and returns its root. */
async function writePackage(slug: string, {name, version, files}: FixturePackage): Promise<string> {
  const root = path.join(generatedRoot, slug)
  await rm(root, {recursive: true, force: true})
  await mkdir(path.join(root, 'src'), {recursive: true})
  await writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({name, ...(version === undefined ? {} : {version}), type: 'module'}),
  )
  for (const [file, source] of Object.entries(files)) {
    await writeFile(path.join(root, 'src', file), source)
  }
  return root
}

interface BuildResult {
  /** The serialized exports of the entry module, by export name. */
  exports: Record<string, string>
  /** The CSS of every virtual `.vanilla.css` module of the compilation, by file name. */
  css: Record<string, string>
}

/**
 * Compiles and evaluates a `.css.ts` module of a fixture package exactly like
 * `@sanity/vanilla-extract-rolldown-plugin` (and through it the tsdown plugin) does.
 */
async function build(
  root: string,
  file: string,
  identOption: IdentifierOption = 'short',
  options: Pick<Parameters<typeof processVanillaFile>[0], 'serializeVirtualCssPath'> = {},
): Promise<BuildResult> {
  const filePath = path.join(root, 'src', file)
  const {source} = await compile({filePath, cwd: root, identOption})
  const output = await processVanillaFile({source, filePath, identOption, ...options})

  const exports: Record<string, string> = {}
  for (const match of output.matchAll(/^export var (\w+) = (["'])(.*)\2;$/gm)) {
    exports[match[1]!] = match[3]!
  }
  const css: Record<string, string> = {}
  for (const match of output.matchAll(/^import '([^']+\.vanilla\.css\?source=[^']*)';$/gm)) {
    // The virtual file names are the file scopes' root-relative paths plus `.vanilla.css`
    const {fileName, source: fileCss} = await getSourceFromVirtualCssFile(match[1]!)
    css[fileName] = fileCss
  }
  return {exports, css}
}

/** The class names in a build's exports (space separated class lists split up). */
function classNames({exports}: BuildResult): string[] {
  return Object.values(exports).flatMap((classList) => classList.split(' '))
}

/** The CSS of a build with every class name replaced by the name of the export it belongs to. */
function cssByExportName({exports, css}: BuildResult): string {
  let result = Object.values(css).join('\n')
  for (const [exportName, className] of Object.entries(exports)) {
    result = result.replaceAll(`.${className}`, `.<${exportName}>`)
  }
  return result
}

describe('identifiers', () => {
  test('are deterministic: the same name, version and source give the same identifiers', async () => {
    const fixture: FixturePackage = {
      name: '@acme/widgets',
      version: '1.0.0',
      files: {'button.css.ts': buttonV1},
    }
    // Two directories, so the location of the package cannot leak into the identifiers
    const first = await build(await writePackage('deterministic-a', fixture), 'button.css.ts')
    const second = await build(await writePackage('deterministic-b', fixture), 'button.css.ts')

    expect(second).toEqual(first)
    expect(Object.keys(first.exports)).toEqual(['overlay', 'root'])
  })

  test('differ between two versions of a package with identical styles', async () => {
    const files = {'button.css.ts': buttonV1}
    const v1 = await build(
      await writePackage('version-1', {name: '@acme/widgets', version: '1.0.0', files}),
      'button.css.ts',
    )
    const v2 = await build(
      await writePackage('version-2', {name: '@acme/widgets', version: '2.0.0', files}),
      'button.css.ts',
    )

    // The styles are the same...
    expect(cssByExportName(v2)).toBe(cssByExportName(v1))
    // ...but no identifier is shared, so neither version's CSS can style the other's markup
    for (const className of classNames(v2)) {
      expect(classNames(v1), `${className} is reused by both versions`).not.toContain(className)
    }
  })

  test('differ when the styles of a module change (SAPP-4639: a renumbered class)', async () => {
    const name = '@acme/widgets'
    const version = '1.0.0'
    const before = await build(
      await writePackage('content-before', {name, version, files: {'button.css.ts': buttonV1}}),
      'button.css.ts',
    )
    const after = await build(
      await writePackage('content-after', {name, version, files: {'button.css.ts': buttonV2}}),
      'button.css.ts',
    )

    // Without the fix the first style of each module gets the same class name, so the overlay
    // rules of the old stylesheet apply to the new root element: an opaque box over everything
    expect(after.exports['root']).not.toBe(before.exports['overlay'])
    for (const className of classNames(after)) {
      expect(classNames(before), `${className} is reused by both builds`).not.toContain(className)
    }
  })

  test('keep the counter structure of upstream, so identifiers stay as short as before', async () => {
    const root = await writePackage('short', {
      name: '@acme/widgets',
      version: '1.0.0',
      files: {'button.css.ts': buttonV2},
    })
    const {exports} = await build(root, 'button.css.ts')

    // `<hash><counter>`: a base36 murmur2 hash (up to 7 chars, `_`-prefixed when it starts
    // with a digit) followed by the per-file counter
    const hashes = new Set<string>()
    for (const [exportName, className] of Object.entries(exports)) {
      expect(className, exportName).toMatch(/^_?[0-9a-z]{1,7}[0-9a-z]$/)
      hashes.add(className.replace(/^_/, '').slice(0, -1))
    }
    expect(hashes.size, 'one file-scope hash shared by the module').toBe(1)
    const counters = Object.fromEntries(
      Object.entries(exports).map(([exportName, className]) => [exportName, className.at(-1)]),
    )
    expect(counters).toEqual({root: '0', loading: '1', overlay: '2'})
  })

  test('are the same for a shared dependency from every entry', async () => {
    const root = await writePackage('shared-dependency', {
      name: '@acme/widgets',
      version: '1.0.0',
      files: {'theme.css.ts': themeCssTs, 'entry.css.ts': entryCssTs},
    })

    // `theme.css.ts` is evaluated once through the entry that imports it and once on its own:
    // its theme class and vars must come out identical, or the entry's CSS would reference
    // vars the theme never defines
    const viaEntry = await build(root, 'entry.css.ts')
    const standalone = await build(root, 'theme.css.ts')

    expect(viaEntry.css['src/theme.css.ts.vanilla.css']).toBeTruthy()
    expect(viaEntry.css['src/theme.css.ts.vanilla.css']).toBe(
      standalone.css['src/theme.css.ts.vanilla.css'],
    )
    expect(viaEntry.css['src/entry.css.ts.vanilla.css']).toContain(
      `.${standalone.exports['themeClass']} .${viaEntry.exports['box']}`,
    )
  })

  test('hand custom identifier functions and serializeVirtualCssPath the bare package name', async () => {
    const root = await writePackage('bare-package-name', {
      name: '@acme/widgets',
      version: '1.0.0',
      files: {'button.css.ts': buttonV1},
    })
    const identOptionCalls: {packageName?: string; filePath: string; hash: string}[] = []
    const fileScopes: {packageName?: string; filePath: string}[] = []

    const {exports} = await build(
      root,
      'button.css.ts',
      ({hash, filePath, packageName}) => {
        identOptionCalls.push({hash, filePath, packageName})
        return `acme_${hash}`
      },
      {
        serializeVirtualCssPath: ({fileName, fileScope}) => {
          fileScopes.push(fileScope)
          return `import '${fileName}?custom';`
        },
      },
    )

    expect(Object.values(exports)).toEqual(identOptionCalls.map(({hash}) => `acme_${hash}`))
    for (const call of identOptionCalls) {
      expect(call).toMatchObject({packageName: '@acme/widgets', filePath: 'src/button.css.ts'})
    }
    expect(fileScopes).toEqual([{filePath: 'src/button.css.ts', packageName: '@acme/widgets'}])
  })

  test('differ per version for a package without a version too, through the source digest', async () => {
    const name = 'versionless-app'
    const before = await build(
      await writePackage('versionless-before', {name, files: {'button.css.ts': buttonV1}}),
      'button.css.ts',
    )
    const after = await build(
      await writePackage('versionless-after', {name, files: {'button.css.ts': buttonV2}}),
      'button.css.ts',
    )

    expect(after.exports['root']).not.toBe(before.exports['overlay'])
    for (const className of classNames(after)) {
      expect(classNames(before), `${className} is reused by both builds`).not.toContain(className)
    }
  })
})
