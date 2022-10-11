import {watch} from '../node/watch'
import {_handleError} from './_handleError'

export async function watchAction(options: {strict?: boolean; tsconfig?: string}): Promise<void> {
  try {
    await watch({
      cwd: process.cwd(),
      strict: options.strict,
      tsconfig: options.tsconfig,
    })
  } catch (err) {
    _handleError(err)
  }
}
