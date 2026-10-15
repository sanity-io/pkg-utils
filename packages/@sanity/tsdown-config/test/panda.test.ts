import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {x} from 'tinyexec'
import {describe, expect, test} from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(__dirname, 'fixtures/panda-library')

/** Runs a JS snippet in a plain Node process, returning its stdout. */
async function runNode(script: string): Promise<string> {
  const result = await x('node', ['-e', script], {throwOnError: true})
  return result.stdout.trim()
}

/**
 * A `file://` URL string for dynamic `import()` in the spawned Node process: a raw absolute
 * path is not a valid ESM specifier on Windows (the drive letter parses as a URL scheme).
 */
function fileUrl(...segments: string[]): string {
  return pathToFileURL(path.join(...segments)).href
}

const conditionalCssExport = {
  types: './dist/bundle-css.d.ts',
  browser: './dist/bundle.css',
  style: './dist/bundle.css',
  node: './dist/bundle-css.js',
  default: './dist/bundle-css.js',
}

describe('panda-library', () => {
  test('rewrites the style calls into class names, without the Panda runtime', async () => {
    const [distIndexJs, distIndexCjs] = await Promise.all([
      readFile(path.join(fixtureDir, 'dist/index.js'), 'utf-8'),
      readFile(path.join(fixtureDir, 'dist/index.cjs'), 'utf-8'),
    ])

    for (const code of [distIndexJs, distIndexCjs]) {
      // `@pandacss/transformer` replaced the `css()` calls with the class names Panda
      // generated for them …
      expect(code).toContain('"color_brand display_flex inset_0"')
      // … so neither the calls nor the `#styled-system` runtime they import survive
      expect(code).not.toMatch(/\bcss\(/)
      expect(code).not.toContain('styled-system')
      // The styles themselves are extracted, not inlined into the JS output
      expect(code).not.toContain('rgb(1, 2, 3)')
      expect(code).not.toContain('#010203')
    }
  })

  test('extracts and lowers the CSS into bundle.css', async () => {
    const bundleCss = await readFile(path.join(fixtureDir, 'dist/bundle.css'), 'utf-8')

    // The tokens and the utilities land in their Panda layers, as blocks: no
    // `@layer reset, base, …;` declaration (ordering the layers is the consumer's call), and
    // no statement left behind for the layers the optimization emptied
    expect(bundleCss).toContain('@layer tokens {')
    expect(bundleCss).toContain('--colors-brand: #f03e2f')
    expect(bundleCss).toContain('@layer utilities {')
    expect(bundleCss).toContain('color: var(--colors-brand)')
    expect(bundleCss).not.toMatch(/@layer\s+[^{};]+;/)
    expect(bundleCss).not.toContain('@layer base')
    // The `--made-with-panda` marker is removed through lightningcss's `unusedSymbols`
    expect(bundleCss).not.toContain('--made-with-panda')

    // lightningcss processes the CSS (the fixture's chrome61 `target` provides the lowering
    // targets), normalizing the `rgb(1, 2, 3)` marker to `#010203`. `minify` is not enabled,
    // so the whitespace stays
    expect(bundleCss).toContain('#010203')
    expect(bundleCss).not.toContain('rgb(1, 2, 3)')
    expect(bundleCss).toContain('top: 0')
    expect(bundleCss).not.toContain('top:0')
  })

  test("uses tsdown's top-level `target` as the CSS syntax lowering target", async () => {
    const bundleCss = await readFile(path.join(fixtureDir, 'dist/bundle.css'), 'utf-8')

    // The fixture sets `target: 'chrome61'`, which predates the `inset` shorthand, so
    // lightningcss must flatten it into `top`/`right`/`bottom`/`left`. This also proves the
    // `@sanity/browserslist-config` fallback stayed out of the way: its modern browsers would
    // have kept `inset` as-is.
    expect(bundleCss).not.toContain('inset:')
    expect(bundleCss).toContain('top:')
  })

  test('emits the no-op JS shim and its type declaration', async () => {
    const [shim, shimDts] = await Promise.all([
      readFile(path.join(fixtureDir, 'dist/bundle-css.js'), 'utf-8'),
      readFile(path.join(fixtureDir, 'dist/bundle-css.d.ts'), 'utf-8'),
    ])

    // The shim must be free of JS syntax so it parses as both CommonJS and an ES module,
    // regardless of the package `type`
    expect(shim).toContain('No-op shim')
    expect(shim.replaceAll(/^\/\/[^\n]*$/gm, '').trim()).toBe('')
    // The conditional export's `types` condition points at the shim's `.d.ts`; a separate
    // `bundle.css.d.ts` for the CSS file itself is unnecessary.
    expect(shimDts).toContain('export {}')
    await expect(readFile(path.join(fixtureDir, 'dist/bundle.css.d.ts'), 'utf-8')).rejects.toThrow()
  })

  test('injects the self-referential CSS import into the entry chunks', async () => {
    const [distIndexJs, distIndexCjs] = await Promise.all([
      readFile(path.join(fixtureDir, 'dist/index.js'), 'utf-8'),
      readFile(path.join(fixtureDir, 'dist/index.cjs'), 'utf-8'),
    ])

    // Compat mode injects `import "<pkg>/bundle.css"` (or `require()` for CJS) so consumers load
    // the extracted CSS through the conditional `./bundle.css` export.
    expect(distIndexJs).toContain('import "@fixtures/panda-library/bundle.css"')
    expect(distIndexCjs).toContain('require("@fixtures/panda-library/bundle.css")')

    // The exported bindings should still be present
    expect(distIndexJs).toContain('getBoxClassName')
    expect(distIndexCjs).toContain('getBoxClassName')
  })

  test('does not inject the CSS import into the .d.ts chunks', async () => {
    const [distIndexDts, distIndexDcts] = await Promise.all([
      readFile(path.join(fixtureDir, 'dist/index.d.ts'), 'utf-8'),
      readFile(path.join(fixtureDir, 'dist/index.d.cts'), 'utf-8'),
    ])

    // (the JSDoc in the fixture source mentions the import, so match actual import statements)
    const cssImportStatement = /^import "@fixtures\/panda-library\/bundle\.css"/m
    expect(distIndexDts).not.toMatch(cssImportStatement)
    expect(distIndexDcts).not.toMatch(cssImportStatement)
  })

  test('writes the conditional ./bundle.css export to package.json', async () => {
    const pkg = JSON.parse(await readFile(path.join(fixtureDir, 'package.json'), 'utf-8'))

    expect(pkg.exports['./bundle.css']).toEqual(conditionalCssExport)
    expect(pkg.publishConfig.exports['./bundle.css']).toEqual(conditionalCssExport)

    // The conditional CSS export is inserted before `./package.json`
    expect(Object.keys(pkg.exports)).toEqual(['.', './bundle.css', './package.json'])
  })
})

describe('panda-runtime-library', () => {
  const runtimeFixtureDir = path.resolve(__dirname, 'fixtures/panda-runtime-library')

  test('`transform: false` keeps the style calls and ships the runtime', async () => {
    const [distIndexJs, distIndexCjs, bundleCss] = await Promise.all([
      readFile(path.join(runtimeFixtureDir, 'dist/index.js'), 'utf-8'),
      readFile(path.join(runtimeFixtureDir, 'dist/index.cjs'), 'utf-8'),
      readFile(path.join(runtimeFixtureDir, 'dist/bundle.css'), 'utf-8'),
    ])

    for (const code of [distIndexJs, distIndexCjs]) {
      // The opt-out of the default rewrite: the call stays, with Panda's `css()` runtime
      // bundled in from the `styled-system` directory, and no static class name string
      expect(code).toMatch(/\bcss\(\{/)
      expect(code).not.toContain('"color_brand display_flex"')
      // The stylesheet is still extracted and loaded
      expect(code).toMatch(/@fixtures\/panda-runtime-library\/bundle\.css/)
    }
    expect(bundleCss).toContain('color: var(--colors-brand)')
    expect(bundleCss).toContain('.display_flex {')

    // The runtime produces the same class names the stylesheet has
    await expect(
      runNode(
        `console.log(require(${JSON.stringify(path.join(runtimeFixtureDir, 'dist/index.cjs'))}).getBoxClassName())`,
      ),
    ).resolves.toBe('color_brand display_flex')
  })
})

describe('panda-react-compiler-library', () => {
  const reactCompilerFixtureDir = path.resolve(__dirname, 'fixtures/panda-react-compiler-library')

  test('extracts the styles of Panda JSX components next to the React Compiler', async () => {
    // The default `oxc` React Compiler lowers JSX in the same pass as it compiles, while
    // `<Box color="brand">` carries its styles only in the JSX: Panda runs first
    const [bundleCss, distIndexJs, distIndexCjs] = await Promise.all([
      readFile(path.join(reactCompilerFixtureDir, 'dist/bundle.css'), 'utf-8'),
      readFile(path.join(reactCompilerFixtureDir, 'dist/index.js'), 'utf-8'),
      readFile(path.join(reactCompilerFixtureDir, 'dist/index.cjs'), 'utf-8'),
    ])
    expect(bundleCss).toContain('.color_brand {')
    expect(bundleCss).toContain('--colors-brand: #f03e2f')

    for (const code of [distIndexJs, distIndexCjs]) {
      // The component was compiled, and its module counts as styled for the CSS import
      expect(code).toContain('react/compiler-runtime')
      expect(code).toContain('@fixtures/panda-react-compiler-library/bundle.css')
      // The transform rewrote the JSX component into an element with its class name
      expect(code).toContain('className: "color_brand"')
    }
  })
})

describe('panda-library runtime', () => {
  // `"type": "module"` package: `.js` files are ESM, so the `node`/`default` conditions of the
  // conditional `./bundle.css` export resolve the shim as an ES module.
  test.each([
    [
      'import()',
      `import(${JSON.stringify(fileUrl(fixtureDir, 'dist/index.js'))}).then((m) => console.log(m.getBoxClassName()))`,
    ],
    [
      'require()',
      `console.log(require(${JSON.stringify(path.join(fixtureDir, 'dist/index.cjs'))}).getBoxClassName())`,
    ],
  ])('the built output loads in plain Node via %s', async (_loader, script) => {
    // The injected self-referential `@fixtures/panda-library/bundle.css` import resolves
    // through the conditional export to the no-op shim instead of crashing on the `.css` file,
    // and the class names are plain strings that need no Panda runtime
    await expect(runNode(script)).resolves.toBe('color_brand display_flex inset_0')
  })
})
