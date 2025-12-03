import {defineConfig as defineTsdownConfig, type UserConfig} from 'tsdown'

/**
 * @public
 */
export interface PackageOptions extends Pick<UserConfig, 'tsconfig' | 'entry' | 'format'> {
  /**
   * @defaultValue 'neutral'
   */
  platform?: UserConfig['platform']
}

/**
 * @public
 */
export function defineConfig(options: PackageOptions = {}): UserConfig {
  const tsconfig = options.tsconfig ?? 'tsconfig.json'
  const platform = options.platform ?? 'neutral'
  const report = {gzip: false} as const satisfies UserConfig['report']
  const publint = true
  const hash = false
  const format = options.format ?? 'esm'
  const inputOptions = {
    preserveEntrySignatures: 'strict',
    experimental: {attachDebugInfo: 'none'},
  } as const satisfies UserConfig['inputOptions']
  const outputOptions = {
    hoistTransitiveImports: false,
  } as const satisfies UserConfig['outputOptions']
  const exports = {
    enabled: 'local-only',
    // @TODO use @sanity/parse-package-json to determine if devExports should be `true` or `source`
    devExports: true,
  } as const satisfies UserConfig['exports']

  return defineTsdownConfig({
    exports,
    format,
    hash,
    inputOptions,
    outputOptions,
    platform,
    publint,
    report,
    tsconfig,
    // minify: 'dce-only',
    // minify: {compress: true, codegen: false, mangle: false},
    // minify: false,
    // treeshake: {annotations: true, moduleSideEffects: 'no-external'}
  })
}
