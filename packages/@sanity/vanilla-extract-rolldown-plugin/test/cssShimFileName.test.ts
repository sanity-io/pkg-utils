import {describe, expect, test} from 'vitest'
import {cssShimDtsFileName, cssShimFileName} from '../src/cssShimFileName.ts'

describe('cssShimFileName', () => {
  test('turns `bundle.css` into `bundle-css.js` (not `bundle.css.js`)', () => {
    // So vanilla-extract's `cssFileFilter` (`/\.css\.(js|…)$/`) does not match the shim.
    expect(cssShimFileName('bundle.css')).toBe('bundle-css.js')
    expect(cssShimFileName('styles.css')).toBe('styles-css.js')
  })

  test('derives the shim declaration file name for the export `types` target', () => {
    expect(cssShimDtsFileName('bundle.css')).toBe('bundle-css.d.ts')
    expect(cssShimDtsFileName('styles.css')).toBe('styles-css.d.ts')
  })
})
