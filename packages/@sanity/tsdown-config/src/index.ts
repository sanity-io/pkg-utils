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
  const {entry} = options
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
    entry,
    exports,
    format,
    hash,
    inputOptions,
    outputOptions,
    platform,
    publint,
    report,
    tsconfig,
    minify: {compress: true, codegen: false, mangle: false},
    treeshake: {
      annotations: true,
      propertyReadSideEffects: false,
      moduleSideEffects: [
        // If the module ends with `.css` it is considered to be a side effect, even if the module is marked as no side effect,
        {test: /\.css$/, sideEffects: true},
        // This is the equivalent of `moduleSideEffects: 'no-external'`, and included here so it works the same as before the CSS exemption were added.
        {external: true, sideEffects: false},
      ],
    },
  })
}
