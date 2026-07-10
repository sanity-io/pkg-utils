import type {PluginItem as BabelPluginItem} from '@babel/core'
import type {OptimizeLodashOptions} from '@optimize-lodash/rollup-plugin'
import type {PkgExports} from '@sanity/parse-package-json'
import type {Options as VanillaExtractOptions} from '@vanilla-extract/rollup-plugin'
import type {PluginOptions as ReactCompilerOptions} from 'babel-plugin-react-compiler'
import type {NormalizedOutputOptions, Plugin as RollupPlugin, TreeshakingOptions} from 'rollup'
import type {StrictOptions} from '../../strict.ts'

export type {PkgExport, PkgExports} from '@sanity/parse-package-json'

/** @public */
export type PkgFormat = 'commonjs' | 'esm'

/**
 * Options for the `@vanilla-extract/rollup-plugin` integration, including pkg-utils-specific
 * extensions (`minify`, `browserslist`, and `extract.compatMode`).
 * @alpha
 */
export interface PkgVanillaExtractOptions extends Omit<VanillaExtractOptions, 'extract'> {
  /**
   * Minify the extracted CSS with `lightningcss`.
   * @defaultValue true
   */
  minify?: boolean
  /**
   * Browserslist query passed to `lightningcss` when optimizing the extracted CSS.
   * @defaultValue the project's browserslist config, falling back to pkg-utils' default query
   */
  browserslist?: string | string[]
  /**
   * Different formatting of identifiers (e.g. class names, keyframes, CSS Vars, etc).
   * @defaultValue "short"
   */
  identifiers?: VanillaExtractOptions['identifiers']
  /**
   * Extract the CSS into a separate file. pkg-utils always extracts, so this configures _how_.
   */
  extract?: {
    /**
     * Name of the emitted `.css` file (and, with `compatMode`, the `exports` subpath + shim base).
     * @defaultValue "bundle.css"
     */
    name?: string
    /**
     * Generate a `.css.map` sourcemap file.
     * @defaultValue true
     */
    sourcemap?: boolean
    /**
     * Compatibility mode automatically wires up the conditional CSS export pattern so userland does
     * not have to. When enabled, pkg-utils:
     *
     * - injects `import "<pkg-name>/<name>"` into each entry chunk (no manual `rollup.output.intro`),
     * - emits a no-op `<name>.js` shim for runtimes that cannot import `.css` files, and
     * - writes the conditional `"./<name>"` export to `package.json`
     *   (`browser`/`style` → the real CSS, `node`/`default` → the shim).
     *
     * The result is that `import "<pkg>/<name>"` resolves to the real CSS in bundlers/browsers and
     * to the no-op shim in Node and similar runtimes. Disable it to wire these up yourself.
     * @defaultValue true
     */
    compatMode?: boolean
  }
}

/** @public */
export type PkgRuntime = '*' | 'browser' | 'node'

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
          /** @defaultValue false */
          fileName?: boolean
          /** @defaultValue ["index"] */
          meaninglessFileNames?: string[]
          /** @defaultValue true */
          minify?: boolean
          /**
           * Transpiles `styled.button`...`` to `styled.button(["..."])` so that the `pure` option can
           * annotate a plain call expression, as pure annotations on tagged template expressions aren't
           * supported by bundlers (https://github.com/rollup/rollup/issues/4035). Without it unused
           * styled components can't be tree-shaken.
           * @defaultValue true
           */
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
     * When set to false, disables type checking during type definition generation.
     * This is equivalent to setting `"noCheck": true` in tsconfig.json but can be
     * controlled from package.config.ts without needing multiple tsconfig files.
     * @defaultValue undefined (uses tsconfig.json settings)
     */
    checkTypes?: boolean
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
     * Defaults to Rollup's `preset: 'recommended'` tree-shaking options. Anything provided here
     * is merged on top of that preset.
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
     * Enables \@vanilla-extract/rollup-plugin to extract CSS into a separate file, with support for
     * minifying the extracted CSS. Pass `true` to use the defaults, or an object to customize.
     *
     * By default (`extract.compatMode: true`) pkg-utils also injects the self-referential
     * `import "<pkg>/bundle.css"`, emits a `bundle.css.js` shim, and writes the conditional
     * `"./bundle.css"` export to `package.json` - see {@link PkgVanillaExtractOptions}.
     * @alpha
     */
    vanillaExtract?: boolean | PkgVanillaExtractOptions
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
   * When using `dts: 'rolldown'`, enables the use of the Go-native TypeScript compiler (`tsgo`) for type generation.
   * By default, `tsgo` is automatically enabled if `@typescript/native-preview` is found in `devDependencies`,
   * or if the installed `typescript` is v7 (which is the Go-native compiler).
   * Set to `true` to explicitly enable or `false` to explicitly disable.
   * Note that `tsgo` cannot be disabled when `typescript` v7 is installed, as v7 no longer ships
   * the JS compiler API that the non-tsgo code path depends on.
   * @alpha
   */
  tsgo?: boolean
}
