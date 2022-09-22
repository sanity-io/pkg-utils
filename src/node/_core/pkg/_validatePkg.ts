import {z} from 'zod'
import {_PackageJSON} from './_types'

const pkgSchema = z.object({
  type: z.optional(z.enum(['commonjs', 'module'])),
  name: z.string(),
  version: z.string(),
  license: z.string(),
  bin: z.optional(z.record(z.string())),
  dependencies: z.optional(z.record(z.string())),
  devDependencies: z.optional(z.record(z.string())),
  peerDependencies: z.optional(z.record(z.string())),
  source: z.optional(z.string()),
  main: z.optional(z.string()),
  browser: z.optional(z.record(z.string())),
  module: z.optional(z.string()),
  types: z.optional(z.string()),
  exports: z.optional(
    z.record(
      z.object({
        types: z.optional(z.string()),
        source: z.string(),
        browser: z.optional(
          z.object({
            source: z.string(),
            require: z.optional(z.string()),
            import: z.optional(z.string()),
          })
        ),
        node: z.optional(
          z.object({
            source: z.string(),
            require: z.optional(z.string()),
            import: z.optional(z.string()),
          })
        ),
        require: z.optional(z.string()),
        import: z.optional(z.string()),
        default: z.string(),
      })
    )
  ),
  browserslist: z.optional(z.array(z.string())),
})

export function _validatePkg(input: unknown): _PackageJSON {
  const pkg = pkgSchema.parse(input)

  return {...pkg, type: pkg.type || 'commonjs'}
}
