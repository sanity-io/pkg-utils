import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {x} from 'tinyexec'
import {describe, expect, test} from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(__dirname, 'fixtures/circular-dependency-library')

// oxlint-disable-next-line eslint/no-control-regex -- matching the ESC of a CSI sequence
const RE_ANSI_COLOR = /\u001B\[\d*(?:;\d+)*m/g
const RE_CIRCULAR_DEPENDENCY = /Circular dependency: (.+?)\.$/gm

/** The `->`-joined cycles of every `CIRCULAR_DEPENDENCY` warning a build printed, sorted. */
async function buildCycles(config?: string): Promise<string[]> {
  const {stdout, stderr} = await x(
    'pnpm',
    ['exec', 'tsdown', ...(config ? ['--config', config] : [])],
    {nodeOptions: {cwd: fixtureDir}, throwOnError: true},
  )
  const output = `${stdout}\n${stderr}`.replace(RE_ANSI_COLOR, '')
  return [...output.matchAll(RE_CIRCULAR_DEPENDENCY)].map(([, cycle]) => cycle!).toSorted()
}

describe('circular-dependency-library', () => {
  test(
    'warns about the runtime cycle, not the declaration-only ones',
    {timeout: 120_000},
    async () => {
      // The fixture's public types are mutually recursive (`DocumentNode` ↔ `FieldNode`), which
      // makes the declaration bundling pass emit a `.d.ts` import cycle per entry pair. Those
      // imports are erased at runtime, so the warnings are noise — the kind that drowned out the
      // real ones in https://github.com/sanity-io/sanity/pull/13753
      expect(await buildCycles()).toEqual([
        'src/describeTree.ts -> src/describeField.ts -> src/describeTree.ts',
      ])
    },
  )

  test('reports every cycle without the suppression', {timeout: 120_000}, async () => {
    // Same fixture, with `suppressWarnings` merged over the config to replace the default —
    // both the baseline this fixture exists to filter and the documented escape hatch
    expect(await buildCycles('tsdown.config.unsuppressed.ts')).toEqual([
      'src/describeTree.ts -> src/describeField.ts -> src/describeTree.ts',
      'src/exports/index.d.ts -> src/describeTree.d.ts -> src/exports/index.d.ts',
      'src/exports/index.d.ts -> src/exports/nodes.d.ts -> src/exports/index.d.ts',
    ])
  })
})
