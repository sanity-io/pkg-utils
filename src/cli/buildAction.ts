import {build} from '../node/build'
import {_handleError} from './_handleError'

export async function buildAction(options: {tsconfig?: string}): Promise<void> {
  try {
    await build({
      cwd: process.cwd(),
      tsconfig: options.tsconfig,
    })
  } catch (err) {
    _handleError(err)
  }
}
