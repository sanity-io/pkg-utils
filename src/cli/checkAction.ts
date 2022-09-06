import {check} from '../node/check'

export async function checkAction(options: {strict?: boolean; tsconfig?: string}): Promise<void> {
  return await check({
    cwd: process.cwd(),
    strict: options.strict,
    tsconfig: options.tsconfig,
  })
}
