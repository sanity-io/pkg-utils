import {build} from '../node/build'

export async function buildAction(options: {tsconfig?: string}): Promise<void> {
  return await build({
    cwd: process.cwd(),
    tsconfig: options.tsconfig,
  })
}
