import {watch} from '../node/watch'

export async function watchAction(options: {tsconfig?: string}): Promise<void> {
  return await watch({
    cwd: process.cwd(),
    tsconfig: options.tsconfig,
  })
}
