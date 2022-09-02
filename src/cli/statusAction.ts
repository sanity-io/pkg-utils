import {check} from '../node/check'

export async function statusAction(options: {tsconfig?: string}): Promise<void> {
  return await check({
    cwd: process.cwd(),
    tsconfig: options.tsconfig,
  })
}
