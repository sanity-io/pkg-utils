/** @public */
export type PkgFormat = 'commonjs' | 'esm'

/** @public */
export type PkgRuntime = '*' | 'browser' | 'node'

/** @public */
export interface PkgExport {
  /** @internal */
  _exported?: boolean
  browser?: {
    source?: string
    import?: string
    require?: string
  }
  // electron?: {
  //   node?: string
  //   default?: string
  // }
  import?: string
  require?: string
  source: string
  types?: string
}

/** @public */
export type PkgConfigPropertyResolver<T> = (prev: T) => T

/** @public */
export type PkgConfigProperty<T> = PkgConfigPropertyResolver<T> | T

/** @public */
export interface PkgExports {
  [path: string]: PkgExport
}

/** @public */
export type PkgRuleLevel = 'error' | 'warn' | 'info' | 'off'

/** @public */
export interface PkgConfigOptions {
  /**
   * Directory of distributed & bundled files.
   */
  dist?: string
  exports?: PkgConfigProperty<PkgExports>
  extract?: {
    rules?: {
      'ae-forgotten-export'?: PkgRuleLevel
      'ae-incompatible-release-tags'?: PkgRuleLevel
      'ae-internal-missing-underscore'?: PkgRuleLevel
      'ae-missing-release-tag'?: PkgRuleLevel
    }
  }
  /**
   * Packages to exclude from the bundles.
   */
  external?: PkgConfigProperty<string[]>
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
}
