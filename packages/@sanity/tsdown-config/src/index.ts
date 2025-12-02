import {defineConfig as defineTsdownConfig, type UserConfig} from 'tsdown'

/**
 * @public
 */
export interface PackageOptions extends Pick<UserConfig, 'tsconfig' | 'entry' | 'format'> {}

/**
 * @public
 */
export function defineConfig(options: PackageOptions = {}): UserConfig {
  return defineTsdownConfig({
    tsconfig: options.tsconfig ?? 'tsconfig.json',
    platform: 'neutral',
    report: {gzip: false},
    publint: true,
    format: options.format ?? 'esm',
    inputOptions: {experimental: {attachDebugInfo: 'none'}},
    exports: {
      enabled: 'local-only',
      devExports: 'source',
    },
  })
}
