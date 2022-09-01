/**
 * @public
 */
export type PackageFormat = 'commonjs' | 'esm'

/**
 * @public
 */
export type PackageRuntime = '*' | 'browser' | 'node'

/**
 * @public
 */
export interface PackageExport {
  _exported: boolean
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

/**
 * @public
 */
export type ConfigPropertyResolver<T> = (prev: T) => T

/**
 * @public
 */
export type ConfigProperty<T> = ConfigPropertyResolver<T> | T

/**
 * @public
 */
export interface PackageExports {
  [path: string]: PackageExport
}

/**
 * @public
 */
export interface PkgConfigOptions {
  /**
   * Directory of distributed & bundled files.
   */
  dist?: string
  exports?: ConfigProperty<PackageExports>
  /**
   * Packages to exclude from the bundles.
   */
  external?: ConfigProperty<string[]>
  /**
   * Default runtime of package exports
   */
  runtime?: PackageRuntime
  /**
   * Directory of source files.
   */
  src?: string
}
