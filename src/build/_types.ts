import {PackageExports, PackageRuntime, PkgConfigOptions, _PackageJSON} from '../core'

/**
 * @internal
 */
export interface _BuildFile {
  type: 'asset' | 'chunk' | 'types'
  path: string
}

/**
 * @internal
 */
export interface _BuildContext {
  config?: PkgConfigOptions
  cwd: string
  exports: PackageExports | undefined
  external: string[]
  extract: boolean
  files: _BuildFile[]
  dist: string
  pkg: _PackageJSON
  runtime: PackageRuntime
  src: string
  target: Record<PackageRuntime, string[]>
  tsconfig?: string
}
