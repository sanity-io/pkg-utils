import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {describe, expect, test} from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(__dirname, 'fixtures/css-modules-library')

describe('css modules', () => {
  test('emits CSS modules into style.css via @tsdown/css', async () => {
    const styleCss = await readFile(path.join(fixtureDir, 'dist/style.css'), 'utf-8')

    // The module CSS marker color (lightningcss may leave it as rgb or normalize to hex)
    expect(styleCss).toMatch(/(?:#040506|rgb\(4,\s*5,\s*6\))/)
    // Class names are scoped (not only the authored local names)
    expect(styleCss).toMatch(/\.[\w-]*title[\w-]*/)
    expect(styleCss).toMatch(/\.[\w-]*action[-_]?button[\w-]*/i)
  })

  test('injects the stylesheet as a self-referential import', async () => {
    const distIndexJs = await readFile(path.join(fixtureDir, 'dist/index.js'), 'utf-8')

    // The bare specifier of the conditional CSS export resolves to a no-op shim in runtimes
    // that cannot load `.css` files. `@tsdown/css` would emit a relative
    // `import "./style.css"`, which throws there.
    expect(distIndexJs).toContain('import "@fixtures/css-modules-library/style.css"')
    expect(distIndexJs).not.toMatch(/import\s+["']\.\/style\.css["']/)

    // The authored colour marker stays out of the JS; the modules map exports the scoped names
    expect(distIndexJs).not.toContain('rgb(4, 5, 6)')
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

  test('wires a conditional export and no-op shim', async () => {
    const [cssShim, pkgRaw] = await Promise.all([
      readFile(path.join(fixtureDir, 'dist/style-css.js'), 'utf-8'),
      readFile(path.join(fixtureDir, 'package.json'), 'utf-8'),
    ])
    const pkg = JSON.parse(pkgRaw)

    expect(cssShim).toContain('No-op shim for `style.css`')
    expect(pkg.exports['./style.css']).toEqual({
      types: './dist/style-css.d.ts',
      browser: './dist/style.css',
      style: './dist/style.css',
      node: './dist/style-css.js',
      default: './dist/style-css.js',
    })
  })
})
