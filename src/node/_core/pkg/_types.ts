/** @internal */
export interface _PackageJSON {
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
    {
      source: string
      types?: string
      browser?: {
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
  source: string
  module?: string
  types?: string
  browserslist?: string[]
}
