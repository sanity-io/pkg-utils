import type ts from 'typescript'
import type {Logger} from '../../logger'
import type {PkgConfigOptions, PkgExports, PkgRuntime} from '../config/types'
import type {PackageJSON} from '../pkg/types'

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
  bundledPackages: string[]
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
