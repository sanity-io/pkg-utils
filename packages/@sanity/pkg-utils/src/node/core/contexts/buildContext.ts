import type ts from 'typescript'
import type {Logger} from '../../logger.ts'
import type {PkgConfigOptions, PkgExports, PkgRuntime} from '../config/types.ts'
import type {PackageJSON} from '../pkg/types.ts'

/** @internal */
export interface BuildFile {
  type: 'asset' | 'chunk' | 'types'
  path: string
}

/** @internal */
export interface BuildContext {
  config?: PkgConfigOptions | undefined
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
    config?: ts.ParsedCommandLine | undefined
    configPath?: string | undefined
  }
  dts: 'tsdown'
}
