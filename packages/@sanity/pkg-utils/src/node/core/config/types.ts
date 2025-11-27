import type {PluginItem as BabelPluginItem} from '@babel/core'
import type {OptimizeLodashOptions} from '@optimize-lodash/rollup-plugin'
import type {Options as VanillaExtractOptions} from '@vanilla-extract/rollup-plugin'
import type {PluginOptions as ReactCompilerOptions} from 'babel-plugin-react-compiler'
import type {NormalizedOutputOptions, Plugin as RollupPlugin, TreeshakingOptions} from 'rollup'
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

export type DtsType = 'api-extractor' | 'rolldown'

/** @public */
export interface PkgConfigOptions {
  /** @alpha */
  babel?: {
    plugins?: BabelPluginItem[] | null | undefined
    /** @alpha */
    reactCompiler?: boolean
    /** @alpha */
    styledComponents?:
      | boolean
      | {
          /** @defaultValue true */
          displayName?: boolean
          /**
           * @defaultValue []
           * @example ["\@xstyled/styled-components", "\@xstyled/styled-components/*"]
           */
          topLevelImportPaths?: string[]
          /** @defaultValue true */
          ssr?: boolean
          /** @defaultValue fale */
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
  }
  /**
   * Configure the React Compiler.
   * To enable it set `babel.reactCompiler` to `true`
   * @beta */
  reactCompilerOptions?: Partial<ReactCompilerOptions>
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
  /** @alpha */
  rollup?: {
    plugins?: PkgConfigProperty<RollupPlugin[]>
    output?: Partial<NormalizedOutputOptions>
    /**
     * Default options are `preset: 'recommended'` and `propertyReadSideEffects: false`
     * @alpha
     */
    treeshake?: TreeshakingOptions
    /** @alpha */
    experimentalLogSideEffects?: boolean
    /**
     * Adds [hash] to chunk filenames, generally only useful if `@sanity/pkg-utils` is used to deploy a package directly to a CDN.
     * It's not needed when publishing to npm for consumption by other libraries, bundlers and frameworks.
     * @defaultValue false
     */
    hashChunkFileNames?: boolean
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
    vanillaExtract?:
      | boolean
      | (VanillaExtractOptions & {minify?: boolean; browserslist?: string | string[]})
  }
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
   * .d.ts files can be generated either by using `@microsoft/api-extractor` or `rolldown`.
   * `rolldown` is the faster option, but is not yet stable.
   * @defaultValue 'api-extractor'
   */
  dts?: DtsType
  /**
   * When using `dts: 'rolldown'`, enables the use of `@typescript/native-preview` for type generation.
   * By default, `tsgo` is automatically enabled if `@typescript/native-preview` is found in `devDependencies`.
   * Set to `true` to explicitly enable or `false` to explicitly disable.
   * @alpha
   */
  tsgo?: boolean
}
