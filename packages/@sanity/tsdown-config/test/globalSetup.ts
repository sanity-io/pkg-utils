import {x} from 'tinyexec'

export async function setup() {
  const controller = new AbortController()
  const {signal} = controller
  await x('pnpm', ['--filter', "@sanity/tsdoc-config", 'run', 'build'], {throwOnError: true, signal})
  await x(
    'pnpm',
    ['--filter', './packages/@sanity/tsdown-config/test/fixtures/**', 'run', 'build'],
    {throwOnError: true, signal},
  )

  return async () => {
    controller.abort()
  }
}
