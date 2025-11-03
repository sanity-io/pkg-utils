import {build} from '../node/build.ts'
import {handleError} from './handleError.ts'

export async function buildAction(options: {
  emitDeclarationOnly?: boolean
  strict?: boolean
  tsconfig?: string
  clean?: boolean
  quiet?: boolean
}): Promise<void> {
  try {
    await build({
      cwd: process.cwd(),
      emitDeclarationOnly: options.emitDeclarationOnly,
      strict: options.strict,
      tsconfig: options.tsconfig,
      clean: options.clean,
      quiet: options.quiet,
    })
  } catch (err) {
    handleError(err)
  }
}
