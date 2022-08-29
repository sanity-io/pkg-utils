/**
 * @public
 */
export interface PackageSubPathExportEntry {
  runtime?: 'node' | 'web'

  // paths
  source: string
  require?: string
  default?: string
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
  [path: string]: PackageSubPathExportEntry
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
  runtime?: 'node' | 'web'
  /**
   * Directory of source files.
   */
  src?: string
  target?: {
    node?: string[]
    web?: string[]
  }
}
