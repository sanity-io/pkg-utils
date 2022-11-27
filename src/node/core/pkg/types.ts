/** @internal */
export interface PackageJSON {
  type: 'commonjs' | 'module'
  version: string
  private?: boolean
  name: string
  bin?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  exports?: Record<
    string,
    | `./${string}.json`
    | {
        source: string
        types?: string
        browser?: {
          source: string
          require?: string
          import?: string
        }
        node?: {
          source: string
          require?: string
          import?: string
        }
        import?: string
        require?: string
        default: string
      }
  >
  main?: string
  browser?: Record<string, string>
  source?: string
  module?: string
  types?: string
  browserslist?: string[]
}
