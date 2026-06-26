import {describe, expect, test, vi} from 'vitest'
import {bundleCssShim} from '../src/node/tasks/rollup/bundleCssShim'

describe('bundleCssShim', () => {
  test('emits the JS shim and declaration files for both export targets', () => {
    const emitFile = vi.fn()
    const plugin = bundleCssShim({fileName: 'bundle.css.js'})

    plugin.generateBundle?.call(
      {emitFile} as unknown as Parameters<NonNullable<typeof plugin.generateBundle>>[0],
      {},
      {format: 'es'},
    )

    expect(emitFile).toHaveBeenCalledTimes(3)
    expect(emitFile).toHaveBeenCalledWith({
      type: 'asset',
      fileName: 'bundle.css.js',
      source: expect.stringContaining('export default ""'),
    })
    expect(emitFile).toHaveBeenCalledWith({
      type: 'asset',
      fileName: 'bundle.css.d.ts',
      source: expect.stringContaining('Side-effect CSS bundle'),
    })
    expect(emitFile).toHaveBeenCalledWith({
      type: 'asset',
      fileName: 'bundle.css.js.d.ts',
      source: expect.stringContaining('export default css'),
    })
  })
})
