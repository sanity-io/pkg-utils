import {init} from '../node/init.ts'
import {handleError} from './handleError.ts'

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
