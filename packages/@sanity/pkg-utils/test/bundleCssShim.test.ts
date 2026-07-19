import {describe, expect, test, vi} from 'vitest'
import {bundleCssShim} from '../src/node/tasks/rollup/bundleCssShim'

function runGenerateBundle(cssName: string) {
  const plugin = bundleCssShim({cssName})
  const emitFile = vi.fn()
  const generateBundle = plugin.generateBundle
  if (typeof generateBundle !== 'function') {
    throw new Error('expected `generateBundle` to be a function')
  }
  // The plugin only relies on `this.emitFile`, so a minimal context is sufficient.
  generateBundle.call({emitFile} as never, {} as never, {} as never, false)
  return emitFile.mock.calls.map(
    (call) => call[0] as {type: string; fileName: string; source: string},
  )
}

describe('bundleCssShim', () => {
  test('emits the no-op JS shim under a non-`.css.js` name', () => {
    const emitted = runGenerateBundle('bundle.css')
    const shim = emitted.find((file) => file.fileName === 'bundle-css.js')
    expect(shim).toBeDefined()
    expect(shim?.type).toBe('asset')
    expect(shim?.source).toContain('export default ""')
  })

  test('emits a single `.d.ts` for the shim (the export `types` target)', () => {
    const emitted = runGenerateBundle('bundle.css')
    const shimDts = emitted.find((file) => file.fileName === 'bundle-css.d.ts')
    expect(shimDts).toBeDefined()
    expect(shimDts?.type).toBe('asset')
    expect(shimDts?.source).toContain('declare const _default: string')
    expect(shimDts?.source).toContain('export default _default')
    // The conditional export's `types` condition points at the shim's `.d.ts`, so a separate
    // `bundle.css.d.ts` for the CSS file itself is unnecessary.
    expect(emitted.some((file) => file.fileName === 'bundle.css.d.ts')).toBe(false)
  })

  test('respects a custom css name', () => {
    const emitted = runGenerateBundle('styles.css')
    expect(emitted.map((file) => file.fileName).toSorted()).toEqual([
      'styles-css.d.ts',
      'styles-css.js',
    ])
  })
})
