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
  development?: string
  import?: string
  require?: string
  default: string
}

/** @public */
export interface PkgExports {
  [path: string]: PkgExport
}

/** @public */
export interface PackageJSON {
  type?: 'commonjs' | 'module' | undefined
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
        development?: string
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
  publishConfig?: {
    access?: 'public' | 'restricted'
    registry?: string
    tag?: string
    exports?: Record<
      string,
      | string
      | {
          types?: string
          browser?: {
            import?: string
            require?: string
          }
          node?: {
            import?: string
            require?: string
          }
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
    /**
     * Any other npm config option applied at publish time.
     * Undocumented and not guaranteed to be stable.
     */
    [npmConfigKey: string]: unknown
  }
  main?: string
  browser?: Record<string, string>
  source?: string
  module?: string
  types?: string
  typesVersions?: Record<string, Record<string, string[]>>
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
