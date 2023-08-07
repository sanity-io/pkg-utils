/** @internal */
export interface PackageJSON {
  type?: 'commonjs' | 'module'
  version: string
  private?: boolean
  author?: string | {name: string; email?: string; url?: string}
  name: string
  description?: string
  keywords?: string[]
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
          import?: string
          require?: string
        }
        node?: {
          source?: string
          module?: string
          import?: string
          require?: string
        }
        module?: string
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
  files?: string[]
  scripts?: Record<string, string>
  browserslist?: string[]
  engines?: {
    node?: string
    npm?: string
  }
  repository?: string | {type: 'git'; url: string}
  bugs?: string | {url: string; email?: string}
  homepage?: string
  license?: string
}
