import {watch} from '../node/watch'
import {_handleError} from './_handleError'

export async function watchAction(options: {tsconfig?: string}): Promise<void> {
  try {
    await watch({
      cwd: process.cwd(),
      tsconfig: options.tsconfig,
    })
  } catch (err) {
    _handleError(err)
  }
}
