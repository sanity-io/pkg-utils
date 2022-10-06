import {check} from '../node/check'
import {_handleError} from './_handleError'

export async function checkAction(options: {strict?: boolean; tsconfig?: string}): Promise<void> {
  try {
    await check({
      cwd: process.cwd(),
      strict: options.strict,
      tsconfig: options.tsconfig,
    })
  } catch (err) {
    _handleError(err)
  }
}
