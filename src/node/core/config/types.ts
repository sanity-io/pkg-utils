import type {PluginItem as BabelPluginItem} from '@babel/core'
import type {OptimizeLodashOptions} from '@optimize-lodash/rollup-plugin'
import type {NormalizedOutputOptions, Plugin as RollupPlugin, TreeshakingOptions} from 'rollup'

import type {StrictOptions} from '../../strict'

// re-export
export type {RollupPlugin, StrictOptions}

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

/**
 * Until these types are on npm: https://github.com/facebook/react/blob/0bc30748730063e561d87a24a4617526fdd38349/compiler/packages/babel-plugin-react-compiler/src/Entrypoint/Options.ts#L39-L122
 * @alpha
 */
export interface ReactCompilerOptions {
  logger?: ReactCompilerLogger | null

  panicThreshold?: 'ALL_ERRORS' | 'CRITICAL_ERRORS' | 'NONE'

  compilationMode?: 'infer' | 'syntax' | 'annotation' | 'all'

  /*
   * If enabled, Forget will import `useMemoCache` from the given module
   * instead of `react/compiler-runtime`.
   *
   * ```
   * // If set to "react-compiler-runtime"
   * import {c as useMemoCache} from 'react-compiler-runtime';
   * ```
   */
  runtimeModule?: string | null | undefined

  /**
   * By default React Compiler will skip compilation of code that suppresses the default
   * React ESLint rules, since this is a strong indication that the code may be breaking React rules
   * in some way.
   *
   * Use eslintSuppressionRules to pass a custom set of rule names: any code which suppresses the
   * provided rules will skip compilation. To disable this feature (never bailout of compilation
   * even if the default ESLint is suppressed), pass an empty array.
   */
  eslintSuppressionRules?: Array<string> | null | undefined

  sources?: Array<string> | ((filename: string) => boolean) | null

  /**
   * The minimum major version of React that the compiler should emit code for. If the target is 19
   * or higher, the compiler emits direct imports of React runtime APIs needed by the compiler. On
   * versions prior to 19, an extra runtime package react-compiler-runtime is necessary to provide
   * a userspace approximation of runtime APIs.
   */
  target: '17' | '18' | '19'
}

/**
 * @alpha
 * Represents 'events' that may occur during compilation. Events are only
 * recorded when a logger is set (through the config).
 * These are the different types of events:
 * CompileError:
 *   Forget skipped compilation of a function / file due to a known todo,
 *   invalid input, or compiler invariant being broken.
 * CompileSuccess:
 *   Forget successfully compiled a function.
 * PipelineError:
 *   Unexpected errors that occurred during compilation (e.g. failures in
 *   babel or other unhandled exceptions).
 */
export type ReactCompilerLoggerEvent =
  | {
      kind: 'CompileError'
      fnLoc: unknown
      detail: unknown
    }
  | {
      kind: 'CompileDiagnostic'
      fnLoc: unknown
      detail: unknown
    }
  | {
      kind: 'CompileSuccess'
      fnLoc: unknown
      fnName: string | null
      memoSlots: number
      memoBlocks: number
      memoValues: number
      prunedMemoBlocks: number
      prunedMemoValues: number
    }
  | {
      kind: 'PipelineError'
      fnLoc: unknown
      data: string
    }

/**
 * @alpha
 */
export type ReactCompilerLogger = {
  logEvent: (filename: string | null, event: ReactCompilerLoggerEvent) => void
}

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
           * @example ["@xstyled/styled-components", "@xstyled/styled-components/*"]
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
   * To enable it, either:
   * - set `babel.reactCompiler` to `true`
   * - add a `react-compiler` export condition,  before any `browser`, `require` or `import` conditions. After any `react-server` and `node` conditions
   * @alpha */
  reactCompilerOptions?: ReactCompilerOptions
  bundles?: PkgBundle[]
  /** @alpha */
  define?: Record<string, string | number | boolean | undefined | null>
  /**
   * Directory of distributed & bundled files.
   */
  dist?: string
  exports?: PkgConfigProperty<PkgExports>
  extract?: {
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
      'ae-forgotten-export'?: PkgRuleLevel
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
   * Build package with support for legacy exports (writes root `<export>.js` files)
   * @deprecated - will be removed in the next major version
   */
  legacyExports?: boolean
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
  strictOptions?: StrictOptions
}
