import {init} from '../node/init'
import {handleError} from './handleError'

export async function initAction(options: {path: string}): Promise<void> {
  try {
    await init({
      cwd: process.cwd(),
      path: options.path,
    })
  } catch (err) {
    handleError(err)
  }
}
