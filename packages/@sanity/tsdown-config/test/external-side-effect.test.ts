import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {describe, expect, test} from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(__dirname, 'fixtures/external-side-effect')

describe('external-side-effect', () => {
  test('preserves side-effect-only imports of external packages', async () => {
    const [distIndexJs, distIndexCjs] = await Promise.all([
      readFile(path.join(fixtureDir, 'dist/index.js'), 'utf-8'),
      readFile(path.join(fixtureDir, 'dist/index.cjs'), 'utf-8'),
    ])

    // A binding-less, side-effect-only import of an *external* package subpath must survive
    // tree-shaking (e.g. `import 'react-time-ago/locale/en'`). Previously this config set the
    // equivalent of `moduleSideEffects: 'no-external'`, which stripped these imports.
    // See https://github.com/sanity-io/plugins/pull/1468
    expect(distIndexJs).toContain('import "dummy-side-effects/side-effect"')
    expect(distIndexCjs).toContain('require("dummy-side-effects/side-effect")')

    // The exported value should still be present
    expect(distIndexJs).toContain('answer')
    expect(distIndexCjs).toContain('answer')
  })
})
