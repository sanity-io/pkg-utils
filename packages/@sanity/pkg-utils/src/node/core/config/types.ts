import type {PluginItem as BabelPluginItem} from '@babel/core'
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
  /** @alpha */
  babel?: {
    plugins?: BabelPluginItem[] | null | undefined
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
   * Enable React Compiler for automatic React optimizations.
   * Set to `true` to enable with defaults, or provide React Compiler options.
   * @alpha
   */
  reactCompiler?: boolean | Partial<ReactCompilerOptions>
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
   * Configure tsdown-specific options
   * @alpha
   */
  tsdown?: {
    /**
     * Enable experimental tsgo for faster type generation using `@typescript/native-preview`
     * @alpha
     */
    tsgo?: boolean
  }
}
