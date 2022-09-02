import ts from 'typescript'
import {PkgExports, PkgRuntime, PkgConfigOptions} from '../config'
import {_PackageJSON} from '../pkg'

/** @internal */
export interface _BuildFile {
  type: 'asset' | 'chunk' | 'types'
  path: string
}

/** @internal */
export interface _BuildContext {
  config?: PkgConfigOptions
  cwd: string
  dist: string
  exports: PkgExports | undefined
  external: string[]
  files: _BuildFile[]
  logger: {
    log: (...args: unknown[]) => void
    info: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
    success: (...args: unknown[]) => void
  }
  pkg: _PackageJSON
  runtime: PkgRuntime
  src: string
  target: Record<PkgRuntime, string[]>
  ts: {
    config?: ts.ParsedCommandLine
    configPath?: string
  }
}
