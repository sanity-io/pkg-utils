import {check} from '../node/check.ts'
import {handleError} from './handleError.ts'

export async function checkAction(options: {strict?: boolean; tsconfig?: string}): Promise<void> {
  try {
    await check({
      cwd: process.cwd(),
      strict: options.strict,
      tsconfig: options.tsconfig,
    })
  } catch (err) {
    handleError(err)
  }
}
