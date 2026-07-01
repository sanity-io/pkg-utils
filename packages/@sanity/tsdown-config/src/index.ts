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
    // Rely on tsdown's/rolldown's default tree-shaking (`moduleSideEffects: true`) rather than
    // customizing it. Previously this set the equivalent of `moduleSideEffects: 'no-external'`
    // (with a `.css` exemption), which stripped intentional side-effect-only imports of external
    // packages (e.g. `import 'react-time-ago/locale/en'`) from the output. The default preserves
    // those imports while still honoring `package.json` `sideEffects` fields for bundled modules.
  })
}
