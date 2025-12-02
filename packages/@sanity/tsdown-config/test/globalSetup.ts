import {x} from 'tinyexec'

export async function setup() {
  const controller = new AbortController()
  const {signal} = controller
  await x('pnpm', ['--filter', '@fixtures/*','run', 'build'], {throwOnError: true,
    signal,
  })

  return async () => {
    controller.abort()
  }
}
