import {defineConfig as defineTsdownConfig, type UserConfig} from 'tsdown'

/**
 * @public
 */
export interface PackageOptions extends Pick<UserConfig, 'tsconfig' | 'entry'> {}

/**
 * @public
 */
export function definePackage(options: PackageOptions = {}): UserConfig {
  return defineTsdownConfig({
    // @TODO add declarationMap: true to tsconfig presets
    sourcemap: true,
    tsconfig: options.tsconfig ?? 'tsconfig.json',
    platform: 'neutral',
    report: {gzip: false},
    publint: {
      enabled: true,
      strict: true,
    },
    format: ['esm', 'cjs'],
  })
}
