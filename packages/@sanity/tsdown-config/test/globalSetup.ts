import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {x} from 'tinyexec'

// The fixture filter is a path relative to the workspace root, so the builds are spawned
// from there — `pnpm test` then behaves the same from the repo root (how CI runs it) and
// from this package's directory.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')

export async function setup() {
  const controller = new AbortController()
  const {signal} = controller
  // The package itself builds first: `optional-peer-types.test.ts` typechecks consumers
  // against the built `dist/index.d.mts` (what npm consumers resolve), not the source
  await x('pnpm', ['--filter', '@sanity/tsdown-config', 'run', 'build'], {
    throwOnError: true,
    signal,
    nodeOptions: {cwd: repoRoot},
  })
  await x(
    'pnpm',
    [
      '--filter',
      './packages/@sanity/tsdown-config/test/fixtures/**',
      '--parallel',
      '--stream',
      '-r',
      'run',
      'build',
    ],
    {throwOnError: true, signal, nodeOptions: {cwd: repoRoot}},
  )

  return async () => {
    controller.abort()
  }
}
