import {build} from '../node/build'
import {handleError} from './handleError'

export async function buildAction(options: {
  emitDeclarationOnly?: boolean
  strict?: boolean
  tsconfig?: string
  clean?: boolean
}): Promise<void> {
  try {
    await build({
      cwd: process.cwd(),
      emitDeclarationOnly: options.emitDeclarationOnly,
      strict: options.strict,
      tsconfig: options.tsconfig,
      clean: options.clean,
    })
  } catch (err) {
    handleError(err)
  }
}
