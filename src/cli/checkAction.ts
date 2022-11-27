import {check} from '../node/check'
import {handleError} from './handleError'

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
