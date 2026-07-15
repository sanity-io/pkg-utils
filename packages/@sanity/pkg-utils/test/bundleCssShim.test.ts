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

  test('emits `.d.ts` companions for both the CSS file and the shim', () => {
    const emitted = runGenerateBundle('bundle.css')
    const cssDts = emitted.find((file) => file.fileName === 'bundle.css.d.ts')
    const shimDts = emitted.find((file) => file.fileName === 'bundle-css.d.ts')
    expect(cssDts).toBeDefined()
    expect(shimDts).toBeDefined()
    for (const dts of [cssDts, shimDts]) {
      expect(dts?.type).toBe('asset')
      expect(dts?.source).toContain('declare const _default: string')
      expect(dts?.source).toContain('export default _default')
    }
  })

  test('respects a custom css name', () => {
    const emitted = runGenerateBundle('styles.css')
    expect(emitted.map((file) => file.fileName).toSorted()).toEqual([
      'styles-css.d.ts',
      'styles-css.js',
      'styles.css.d.ts',
    ])
  })
})
