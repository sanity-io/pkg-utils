import {x} from 'tinyexec'

export async function setup() {
  const controller = new AbortController()
  const {signal} = controller
  await x('pnpm', ['-r', 'run', 'build'], {
    throwOnError: true,
    signal,
    nodeOptions: {cwd: __dirname},
  })

  return async () => {
    controller.abort()
  }
}
