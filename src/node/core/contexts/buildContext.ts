import ts from 'typescript'
import {Logger} from '../../logger'
import {PkgExports, PkgRuntime, PkgConfigOptions} from '../config'
import {PackageJSON} from '../pkg'

/** @internal */
export interface BuildFile {
  type: 'asset' | 'chunk' | 'types'
  path: string
}

/** @internal */
export interface BuildContext {
  config?: PkgConfigOptions
  cwd: string
  distPath: string
  emitDeclarationOnly: boolean
  exports: PkgExports | undefined
  external: string[]
  files: BuildFile[]
  logger: Logger
  pkg: PackageJSON
  runtime: PkgRuntime
  strict: boolean
  target: Record<PkgRuntime, string[]>
  ts: {
    config?: ts.ParsedCommandLine
    configPath?: string
  }
}
