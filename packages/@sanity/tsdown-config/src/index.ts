import {babel} from '@rollup/plugin-babel'
import type {PluginOptions as ReactCompilerOptions} from 'babel-plugin-react-compiler'
import {defineConfig as defineTsdownConfig, type Rolldown, type UserConfig} from 'tsdown'

/**
 * @public
 */
export interface PackageOptions extends Pick<UserConfig, 'tsconfig' | 'entry' | 'format'> {
  /**
   * @defaultValue 'neutral'
   */
  platform?: UserConfig['platform']
  /** @alpha */
  babel?: {
    /**
     * Runs `babel-plugin-react-compiler` on the source files before they are bundled.
     * Requires `babel-plugin-react-compiler` to be installed.
     * This is the same feature as `babel.reactCompiler` in `@sanity/pkg-utils`.
     * @alpha
     */
    reactCompiler?: boolean
  }
  /**
   * Configure the React Compiler.
   * To enable it set `babel.reactCompiler` to `true`
   * @beta */
  reactCompilerOptions?: Partial<ReactCompilerOptions>
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

  const plugins = options.babel?.reactCompiler
    ? [
        // Rolldown supports most Rollup plugins, but the plugin types are not identical, so the
        // official guidance is to cast: https://tsdown.dev/advanced/plugins#rollup-plugins
        // oxlint-disable-next-line no-unsafe-type-assertion
        babel({
          babelrc: false,
          babelHelpers: 'bundled',
          // Let Babel parse TS and JSX so the React Compiler sees the original JSX, but leave the
          // actual TS and JSX transforms to rolldown's oxc pipeline:
          // https://tsdown.dev/recipes/react-support#react-compiler
          parserOpts: {sourceType: 'module', plugins: ['jsx', 'typescript']},
          plugins: [['babel-plugin-react-compiler', options.reactCompilerOptions ?? {}]],
          extensions: ['.ts', '.tsx', '.js', '.jsx'],
        }) as unknown as Rolldown.Plugin,
      ]
    : undefined

  return defineTsdownConfig({
    entry,
    exports,
    format,
    hash,
    inputOptions,
    outputOptions,
    platform,
    plugins,
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
