import {x} from 'tinyexec'

export async function setup() {
  const controller = new AbortController()
  const {signal} = controller
  await x('pnpm', ['--filter', '"./packages/@sanity/tsdown-config/test/fixtures/**"', '--parallel', '--stream', '-r', 'run', 'build'], {throwOnError: true,
    signal,
  })

  return async () => {
    controller.abort()
  }
}
