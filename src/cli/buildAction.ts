import {build} from '../node/build'
import {_handleError} from './_handleError'

export async function buildAction(options: {
  emitDeclarationOnly?: boolean
  strict?: boolean
  tsconfig?: string
}): Promise<void> {
  try {
    await build({
      cwd: process.cwd(),
      emitDeclarationOnly: options.emitDeclarationOnly,
      strict: options.strict,
      tsconfig: options.tsconfig,
    })
  } catch (err) {
    _handleError(err)
  }
}
