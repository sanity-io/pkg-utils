import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {describe, expect, test} from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(__dirname, 'fixtures/vanilla-extract-css-modules-library')

describe('vanilla-extract + css modules', () => {
  test('extracts vanilla-extract CSS into bundle.css independently of @tsdown/css', async () => {
    const bundleCss = await readFile(path.join(fixtureDir, 'dist/bundle.css'), 'utf-8')

    // Same markers as the vanilla-extract-library fixture: lightningcss minifies/normalizes
    // the VE styles, and chrome61 flattens `inset`
    expect(bundleCss).toContain('#010203')
    expect(bundleCss).not.toContain('rgb(1, 2, 3)')
    expect(bundleCss).toContain('top:0')
    expect(bundleCss).not.toContain('inset:')

    // CSS modules markers must not leak into the vanilla-extract bundle
    expect(bundleCss).not.toContain('#040506')
    expect(bundleCss).not.toContain('rgb(4, 5, 6)')
  })

  test('emits CSS modules into style.css via @tsdown/css', async () => {
    const styleCss = await readFile(path.join(fixtureDir, 'dist/style.css'), 'utf-8')

    // The module CSS marker color (lightningcss may leave it as rgb or normalize to hex)
    expect(styleCss).toMatch(/(?:#040506|rgb\(4,\s*5,\s*6\))/)
    // Class names are scoped (not only the authored local names)
    expect(styleCss).toMatch(/\.[\w-]*title[\w-]*/)
    expect(styleCss).toMatch(/\.[\w-]*action[-_]?button[\w-]*/i)

    // Vanilla-extract markers must not land in the CSS-modules output
    expect(styleCss).not.toContain('#010203')
    expect(styleCss).not.toContain('rgb(1, 2, 3)')
  })

  test('injects both the conditional VE import and the CSS-modules stylesheet import', async () => {
    const distIndexJs = await readFile(path.join(fixtureDir, 'dist/index.js'), 'utf-8')

    expect(distIndexJs).toContain(
      'import "@fixtures/vanilla-extract-css-modules-library/bundle.css"',
    )
    // `css.inject: true` preserves a relative import of the emitted modules stylesheet
    expect(distIndexJs).toMatch(/import\s+["']\.\/style\.css["']/)

    // Virtual VE modules and authored colour markers stay out of the JS; the modules map
    // exports the scoped names instead
    expect(distIndexJs).not.toContain('.vanilla.css')
    expect(distIndexJs).not.toContain('rgb(1, 2, 3)')
    expect(distIndexJs).not.toContain('rgb(4, 5, 6)')
    expect(distIndexJs).toContain('getBoxClassName')
    expect(distIndexJs).toContain('getButtonStyles')
  })

  test('exports scoped CSS-modules class names with camelCase locals', async () => {
    // `localsConvention: 'camelCase'` keeps the original key and adds a camelCase alias for
    // dashed names like `action-button`. The mapping is inlined into the JS output.
    const distIndexJs = await readFile(path.join(fixtureDir, 'dist/index.js'), 'utf-8')

    expect(distIndexJs).toMatch(/\btitle\s*:/)
    expect(distIndexJs).toMatch(/["']action-button["']\s*:/)
    expect(distIndexJs).toMatch(/\bactionButton\s*:/)
  })

  test('still wires the conditional ./bundle.css export and no-op shim for VE', async () => {
    const [shim, pkgRaw] = await Promise.all([
      readFile(path.join(fixtureDir, 'dist/bundle-css.js'), 'utf-8'),
      readFile(path.join(fixtureDir, 'package.json'), 'utf-8'),
    ])
    const pkg = JSON.parse(pkgRaw)

    expect(shim).toContain('No-op shim')
    expect(pkg.exports['./bundle.css']).toEqual({
      types: './dist/bundle-css.d.ts',
      browser: './dist/bundle.css',
      style: './dist/bundle.css',
      node: './dist/bundle-css.js',
      default: './dist/bundle-css.js',
    })
  })
})
