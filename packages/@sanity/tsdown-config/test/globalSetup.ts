import {x} from 'tinyexec'

export async function setup() {
  const controller = new AbortController()
  const {signal} = controller
  // The package itself builds first: `optional-peer-types.test.ts` typechecks consumers
  // against the built `dist/index.d.mts` (what npm consumers resolve), not the source
  await x('pnpm', ['--filter', '@sanity/tsdown-config', 'run', 'build'], {
    throwOnError: true,
    signal,
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
    {throwOnError: true, signal},
  )

  return async () => {
    controller.abort()
  }
}
