/**
 * @internal
 */
export interface _PackageJSON {
  type?: 'module'
  version: string
  private?: boolean
  name: string
  bin?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  exports?: Record<string, string | Record<string, string>>
  main?: string
  source?: string
  module?: string
  types?: string
}
