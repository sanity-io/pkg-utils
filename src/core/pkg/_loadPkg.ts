import pkgUp from 'pkg-up'
import {z} from 'zod'
import {_PackageJSON} from './_types'

// export interface _PackageJSON {
//   type?: 'module'
//   version: string
//   private?: boolean
//   name: string
//   bin?: Record<string, string>
//   dependencies?: Record<string, string>
//   devDependencies?: Record<string, string>
//   peerDependencies?: Record<string, string>
//   exports?: Record<string, string | Record<string, string>>
//   main: string
//   browser?: Record<string, string>
//   source: string
//   module?: string
//   types?: string
//   browserslist?: string[]
// }
const mySchema = z.object({
  type: z.optional(z.enum(['module'])),
  name: z.string(),
  version: z.string(),
  bin: z.optional(z.record(z.string())),
  dependencies: z.optional(z.record(z.string())),
  devDependencies: z.optional(z.record(z.string())),
  peerDependencies: z.optional(z.record(z.string())),
  source: z.string(),
  main: z.optional(z.string()),
  browser: z.optional(z.record(z.string())),
  module: z.optional(z.string()),
  exports: z.optional(
    z.record(
      z.object({
        source: z.string(),
        browser: z.optional(
          z.object({
            require: z.optional(z.string()),
            import: z.optional(z.string()),
          })
        ),
        require: z.optional(z.string()),
        import: z.optional(z.string()),
        types: z.optional(z.string()),
      })
    )
  ),
  browserslist: z.optional(z.array(z.string())),
})

/**
 * @internal
 */
export async function _loadPkg(options: {cwd: string}): Promise<_PackageJSON> {
  const {cwd} = options

  const pkgPath = await pkgUp({cwd})

  if (!pkgPath) throw new Error('no package.json found')

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return mySchema.parse(require(pkgPath))
}
