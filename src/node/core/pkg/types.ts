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
  dependencies?: Record<string, string | undefined>
  devDependencies?: Record<string, string | undefined>
  peerDependencies?: Record<string, string | undefined>
  exports?: Record<
    string,
    | `./${string}.json`
    | `./${string}.css`
    | {
        source?: string
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
    | {
        types?: string
        svelte: string
        default?: string
      }
  >
  main?: string
  browser?: Record<string, string>
  source?: string
  module?: string
  types?: string
  files?: string[]
  scripts?: Record<string, string | undefined>
  browserslist?: string | string[]
  sideEffects?: boolean | string[]
  engines?: {
    node?: string
    npm?: string
  }
  repository?: string | {type: 'git'; url: string}
  bugs?: string | {url: string; email?: string}
  homepage?: string
  license?: string
}
