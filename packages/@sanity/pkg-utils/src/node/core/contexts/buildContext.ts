import type {PackageJSON} from '@sanity/parse-package-json'
import type ts from '@typescript/typescript6'
import type {UserConfig} from 'tsdown'
import type {Logger} from '../../logger.ts'
import type {PkgConfigOptions, PkgExports, PkgRuntime} from '../config/types.ts'

/** @internal */
export interface BuildContext {
  config?: PkgConfigOptions | undefined
  cwd: string
  /**
   * tsdown's `deps` option for the builds: the `deps` config passthrough merged with the
   * mapping of the deprecated `external` option (additions -> `neverBundle`, entries filtered
   * out of the defaults -> `alwaysBundle`) and the self-reference external.
   */
  deps: UserConfig['deps'] | undefined
  distPath: string
  emitDeclarationOnly: boolean
  exports: PkgExports | undefined
  external: string[]
  bundledPackages: string[]
  logger: Logger
  pkg: PackageJSON
  runtime: PkgRuntime
  strict: boolean
  target: Record<PkgRuntime, string[]>
  ts: {
    config?: ReturnType<typeof ts.parseJsonConfigFileContent>
    configPath?: string | undefined
  }
}
