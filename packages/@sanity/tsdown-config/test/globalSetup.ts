import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {x} from 'tinyexec'

// The fixture filter is a workspace-root-relative path, so spawn from there — `pnpm test`
// then works the same from the repo root and from this package's directory
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')

export async function setup() {
  const controller = new AbortController()
  const {signal} = controller
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
