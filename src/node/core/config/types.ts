import {type PluginItem as BabelPluginItem} from '@babel/core'
import {type Plugin as RollupPlugin} from 'rollup'

// re-export
export type {RollupPlugin}

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
  }
  bundles?: PkgBundle[]
  /** @alpha */
  define?: Record<string, string | number | boolean | undefined | null>
  /**
   * Directory of distributed & bundled files.
   */
  dist?: string
  exports?: PkgConfigProperty<PkgExports>
  extract?: {
    bundledPackages?: string[]
    customTags?: TSDocCustomTag[]
    rules?: {
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
   */
  legacyExports?: boolean
  minify?: boolean
  /** @alpha */
  rollup?: {
    plugins?: PkgConfigProperty<RollupPlugin[]>
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
}
