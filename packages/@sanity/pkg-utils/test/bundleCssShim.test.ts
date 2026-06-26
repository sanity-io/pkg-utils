import {describe, expect, test, vi} from 'vitest'
import {bundleCssShim} from '../src/node/tasks/rollup/bundleCssShim'

function runGenerateBundle(fileName: string) {
  const plugin = bundleCssShim({fileName})
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
  test('emits the no-op JS shim', () => {
    const emitted = runGenerateBundle('bundle.css.js')
    const shim = emitted.find((file) => file.fileName === 'bundle.css.js')
    expect(shim).toBeDefined()
    expect(shim?.type).toBe('asset')
    expect(shim?.source).toContain('export default ""')
  })

  test('emits a matching `.d.ts` declaration so dts export checkers do not crash', () => {
    const emitted = runGenerateBundle('bundle.css.js')
    const dts = emitted.find((file) => file.fileName === 'bundle.css.d.ts')
    expect(dts).toBeDefined()
    expect(dts?.type).toBe('asset')
    expect(dts?.source).toContain('declare const _default: string')
    expect(dts?.source).toContain('export default _default')
  })

  test('respects a custom css name', () => {
    const emitted = runGenerateBundle('styles.css.js')
    expect(emitted.map((file) => file.fileName).toSorted()).toEqual([
      'styles.css.d.ts',
      'styles.css.js',
    ])
  })
})
