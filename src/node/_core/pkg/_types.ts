/** @internal */
export interface _PackageJSON {
  type?: 'module'
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
      browser?: {
        require?: string
        import?: string
      }
      require?: string
      import?: string
      types?: string
    }
  >
  main?: string
  browser?: Record<string, string>
  source: string
  module?: string
  types?: string
  browserslist?: string[]
}
