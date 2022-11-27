import {watch} from '../node/watch'
import {handleError} from './handleError'

export async function watchAction(options: {strict?: boolean; tsconfig?: string}): Promise<void> {
  try {
    await watch({
      cwd: process.cwd(),
      strict: options.strict,
      tsconfig: options.tsconfig,
    })
  } catch (err) {
    handleError(err)
  }
}
