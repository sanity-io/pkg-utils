import type {PluginOptions as ReactCompilerPluginOptions} from 'babel-plugin-react-compiler'
import {defineConfig as defineTsdownConfig, type Rolldown, type UserConfig} from 'tsdown'

/**
 * Options for the `styled-components` transform, the same options as `babel-plugin-styled-components`.
 * @public
 */
export interface StyledComponentsOptions {
  /** @defaultValue true */
  displayName?: boolean
  /**
   * @defaultValue []
   * @example ["\@xstyled/styled-components", "\@xstyled/styled-components/*"]
   */
  topLevelImportPaths?: string[]
  /** @defaultValue true */
  ssr?: boolean
  /** @defaultValue false */
  fileName?: boolean
  /** @defaultValue ["index"] */
  meaninglessFileNames?: string[]
  /** @defaultValue true */
  minify?: boolean
  /** @defaultValue false */
  transpileTemplateLiterals?: boolean
  namespace?: string
  /** @defaultValue true */
  pure?: boolean
}

/**
 * Options for the React Compiler, the same options as `babel-plugin-react-compiler`.
 * The typings resolve in userland once `babel-plugin-react-compiler` (an optional peer
 * dependency, required to use `reactCompiler`) is installed, and always match the installed
 * version of the compiler.
 * @public
 */
export type ReactCompilerOptions = Partial<ReactCompilerPluginOptions>

/**
 * @public
 */
export interface PackageOptions extends Pick<UserConfig, 'tsconfig' | 'entry' | 'format'> {
  /**
   * @defaultValue 'neutral'
   */
  platform?: UserConfig['platform']
  /**
   * Runs `babel-plugin-react-compiler` on the source files before they are bundled, so published
   * components are memoized automatically. Pass `true` to use the defaults, or an options object
   * to configure the compiler (e.g. `{target: '18'}`).
   * This is the same feature as the `babel: {reactCompiler: true}` and `reactCompilerOptions`
   * options in `@sanity/pkg-utils`. Unlike `styledComponents` there's no oxc native port of the
   * React Compiler yet, so `babel-plugin-react-compiler` needs to be installed.
   * @defaultValue false
   */
  reactCompiler?: boolean | ReactCompilerOptions
  /**
   * Applies the `styled-components` transform (`displayName`, `componentId`, CSS minification, etc)
   * with the same defaults as the `babel: {styledComponents: true}` option in `@sanity/pkg-utils`.
   * Unlike `@sanity/pkg-utils` it doesn't use `babel-plugin-styled-components`, but oxc's native port of it,
   * so there's no need to install babel dependencies.
   * @defaultValue false
   */
  styledComponents?: boolean | StyledComponentsOptions
}

/**
 * @public
 */
export async function defineConfig(options: PackageOptions = {}): Promise<UserConfig> {
  const {entry} = options
  const tsconfig = options.tsconfig ?? 'tsconfig.json'
  const platform = options.platform ?? 'neutral'
  const reactCompiler = options.reactCompiler ?? false
  const styledComponents = options.styledComponents ?? false
  const report = {gzip: false} as const satisfies UserConfig['report']
  const publint = true
  const hash = false
  const format = options.format ?? 'esm'
  const inputOptions = {
    preserveEntrySignatures: 'strict',
    experimental: {attachDebugInfo: 'none'},
    ...(styledComponents !== false && {
      transform: {
        plugins: {
          styledComponents: {
            // The same defaults as `babel: {styledComponents: true}` in `@sanity/pkg-utils`:
            // `fileName` is unnecessary, as the way we use styled-components in Sanity is usually by wrapping
            // `@sanity/ui` primitives, not declaring new ones like "const Button = styled.button``"
            fileName: false,
            // Native template literals take less space than this transpilation, and unlike
            // `babel-plugin-styled-components`, oxc doesn't add a `@__PURE__` annotation to the
            // transpiled call expression either, so enabling it wouldn't improve tree-shaking
            transpileTemplateLiterals: false,
            // Helps dead code elimination and tree-shaking, although oxc only annotates plain call
            // expressions so far, not tagged template expressions (https://github.com/rollup/rollup/issues/4035)
            pure: true,
            // Disabled, as tsdown tends to be used for npm publishing, while other tooling,
            // like `sanity dev`, `next dev`, etc are used for testing
            cssProp: false,
            ...(typeof styledComponents === 'object' ? styledComponents : {}),
          },
        },
      },
    }),
  } as const satisfies UserConfig['inputOptions']
  const outputOptions = {
    hoistTransitiveImports: false,
  } as const satisfies UserConfig['outputOptions']
  const exports = {
    enabled: 'local-only',
    // @TODO use @sanity/parse-package-json to determine if devExports should be `true` or `source`
    devExports: true,
  } as const satisfies UserConfig['exports']

  const plugins: Rolldown.Plugin[] = []
  if (reactCompiler !== false) {
    // Follows the official tsdown recipe for the React Compiler:
    // https://tsdown.dev/recipes/react-support#enabling-react-compiler
    // The plugins are lazy loaded so they're only paid for when the React Compiler is enabled.
    // `babel-plugin-react-compiler` itself is resolved by Babel from the consumer package during
    // the build, which is why it can be an optional peer dependency. Once rolldown ships its rust
    // port of the React Compiler this can be swapped out for an oxc transform, like `styledComponents`.
    const [{default: pluginBabel}, {reactCompilerPreset}] = await Promise.all([
      import('@rolldown/plugin-babel'),
      import('@vitejs/plugin-react'),
    ])
    plugins.push(
      // The plugin types don't match when `@rolldown/plugin-babel` resolves its `rolldown` peer
      // dependency to a different version than the one bundled with `tsdown`, so cast it:
      // https://tsdown.dev/advanced/plugins#rollup-plugins
      // oxlint-disable-next-line no-unsafe-type-assertion
      (await pluginBabel({
        presets: [reactCompilerPreset(typeof reactCompiler === 'object' ? reactCompiler : {})],
      })) as unknown as Rolldown.Plugin,
    )
  }

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
