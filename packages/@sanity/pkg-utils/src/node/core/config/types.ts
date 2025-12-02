import type {OptimizeLodashOptions} from '@optimize-lodash/rollup-plugin'
import type {Options as VanillaExtractOptions} from '@vanilla-extract/rollup-plugin'
import type {PluginOptions as ReactCompilerOptions} from 'babel-plugin-react-compiler'
import type {StrictOptions} from '../../strict.ts'

/** @public */
export type PkgFormat = 'commonjs' | 'esm'

/** @public */
export type PkgRuntime = '*' | 'browser' | 'node'

/** @public */
export interface PkgExport {
  /** @internal */
  _exported?: boolean
  browser?: {
    source: string
    import?: string
    require?: string
  }
  // electron?: {
  //   node?: string
  //   default?: string
  // }
  node?: {
    source?: string
    import?: string
    require?: string
  }
  types?: string
  source: string
  import?: string
  require?: string
  default: string
}

/** @public */
export type PkgConfigPropertyResolver<T> = (prev: T) => T

/** @public */
export type PkgConfigProperty<T> = PkgConfigPropertyResolver<T> | T

/** @public */
export interface PkgBundle {
  source: string
  import?: string
  require?: string
  runtime?: PkgRuntime
}

/** @public */
export interface PkgExports {
  [path: string]: PkgExport
}

/** @public */
export type PkgRuleLevel = 'error' | 'warn' | 'info' | 'off'

/** @public */
export interface TSDocCustomTag {
  name: string
  syntaxKind: 'block' | 'modifier'
  allowMultiple?: boolean
}

/** @public */
export interface PkgConfigOptions {
  /**
   * Enable React Compiler for automatic React optimizations.
   * Set to `true` to enable with defaults, or provide React Compiler options.
   * @alpha
   */
  reactCompiler?: boolean | Partial<ReactCompilerOptions>
  /**
   * Configure styled-components transformation using rolldown's built-in support.
   * Set to `true` to enable with defaults, or provide styled-components options.
   * @alpha
   */
  styledComponents?:
    | boolean
    // Based on types from https://github.com/rolldown/rolldown/blob/0b2b1f9fa4a4008a9b0c2e07afb132df427c3838/packages/rolldown/src/binding.d.cts#L1061-L1133
    | {
        /**
         * Enhances the attached CSS class name on each component with richer output to help
         * identify your components in the DOM without React DevTools.
         *
         * @defaultValue true
         */
        displayName?: boolean
        /**
         * Controls whether the `displayName` of a component will be prefixed with the filename
         * to make the component name as unique as possible.
         *
         * @defaultValue false
         */
        fileName?: boolean
        /**
         * Adds a unique identifier to every styled component to avoid checksum mismatches
         * due to different class generation on the client and server during server-side rendering.
         *
         * @defaultValue true
         */
        ssr?: boolean
        /**
         * Transpiles styled-components tagged template literals to a smaller representation
         * than what Babel normally creates, helping to reduce bundle size.
         *
         * @defaultValue false
         */
        transpileTemplateLiterals?: boolean
        /**
         * Minifies CSS content by removing all whitespace and comments from your CSS,
         * keeping valuable bytes out of your bundles.
         *
         * @defaultValue true
         */
        minify?: boolean
        /**
         * Enables transformation of JSX `css` prop when using styled-components.
         *
         * **Note: This feature is not yet implemented in oxc.**
         *
         * @defaultValue true
         */
        cssProp?: never
        /**
         * Enables "pure annotation" to aid dead code elimination by bundlers.
         *
         * @defaultValue true
         */
        pure?: boolean
        /**
         * Adds a namespace prefix to component identifiers to ensure class names are unique.
         *
         * Example: With `namespace: "my-app"`, generates `componentId: "my-app__sc-3rfj0a-1"`
         */
        namespace?: string
        /**
         * List of file names that are considered meaningless for component naming purposes.
         *
         * When the `fileName` option is enabled and a component is in a file with a name
         * from this list, the directory name will be used instead of the file name for
         * the component's display name.
         *
         * @defaultValue `["index"]`
         */
        meaninglessFileNames?: string[]
        /**
         * Import paths to be considered as styled-components imports at the top level.
         *
         * **Note: This feature is not yet implemented in oxc.**
         *
         * @defaultValue []
         * @example ["\@xstyled/styled-components", "\@xstyled/styled-components/*"]
         */
        topLevelImportPaths?: never
      }
  bundles?: PkgBundle[]
  /** @alpha */
  define?: Record<string, string | number | boolean | undefined | null>
  /**
   * Directory of distributed & bundled files.
   */
  dist?: string
  exports?: PkgConfigProperty<PkgExports>
  /**
   * Runs `@microsoft/api-extractor` to check that TSDoc tags are valid, and release tags are correct.
   * This is useful for packages that need to be consumed by TSDoc-based tooling.
   * It's enabled by default, it can be disabled by setting `extract: {enabled: false}`
   */
  extract?: {
    /**
     * @defaultValue true
     */
    enabled?: boolean
    /**
     * Packages in `devDependencies` that are not in `external` are automatically added to the `bundledPackages` config.
     * You can exclude a package from being bundled by using a callback:
     * ```
     * bundledPackages: (prev) => prev.filter(package => package !== 'sanity')
     * ```
     */
    bundledPackages?: PkgConfigProperty<string[]>
    customTags?: TSDocCustomTag[]
    rules?: {
      /**
       * @deprecated as it's no longer needed since TypeScript 5.5 https://github.com/microsoft/TypeScript/issues/42873
       */
      'ae-forgotten-export'?: never
      'ae-incompatible-release-tags'?: PkgRuleLevel
      'ae-internal-missing-underscore'?: PkgRuleLevel
      'ae-missing-release-tag'?: PkgRuleLevel
      'tsdoc-link-tag-unescaped-text'?: PkgRuleLevel
      'tsdoc-undefined-tag'?: PkgRuleLevel
      'tsdoc-unsupported-tag'?: PkgRuleLevel
    }
  }
  /**
   * Packages to exclude from bundles.
   * Provide an array to merge with default exclusions, use a function to replace them:
   * ```
   * exclude: (prev) => prev.filter(package => package !== 'foo')
   * ```
   */
  external?: PkgConfigProperty<string[]>
  /**
   * Defaults to `"automatic"`
   */
  jsx?: 'transform' | 'preserve' | 'automatic'
  /**
   * Defaults to `"createElement"`
   */
  jsxFactory?: string
  /**
   * Defaults to `"Fragment"`
   */
  jsxFragment?: string
  /**
   * Defaults to `"react"`
   */
  jsxImportSource?: string
  /**
   * @deprecated no longer supported
   */
  legacyExports?: never
  minify?: boolean
  /**
   * Default runtime of package exports
   */
  runtime?: PkgRuntime
  sourcemap?: boolean
  /**
   * Directory of source files.
   */
  src?: string
  tsconfig?: string
  /**
   * Configure what checks are made when running `--strict` builds and checks
   */
  strictOptions?: Partial<StrictOptions>
  /**
   * Enable experimental tsgo for faster type generation using `@typescript/native-preview`
   * @alpha
   */
  tsgo?: boolean
  /**
   * Optimizes lodash imports using `@optimize-lodash/rollup-plugin` when set to `true`.
   * It's enabled if `lodash` is found in `dependencies` or `peerDependencies`.
   * It will use `lodash-es` for ESM targets if found in `dependencies` or `peerDependencies`.
   * @defaultValue true
   * @alpha
   */
  optimizeLodash?: boolean | OptimizeLodashOptions
  /**
   * Enables \@vanilla-extract/rollup-plugin to extract CSS into a separate file, with support for minifying the extracted CSS.
   * @alpha
   */
  vanillaExtract?: boolean | (VanillaExtractOptions & {minify?: boolean})
}
