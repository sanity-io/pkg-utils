import type {PkgConfigOptions} from './types.ts'

/** @public */
export function defineConfig<const T extends PkgConfigOptions>(configOptions: T): T {
  return configOptions
}
