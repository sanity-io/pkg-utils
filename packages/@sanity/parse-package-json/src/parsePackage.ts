import {z} from 'zod/v3'
import type {PackageJSON} from './types'

const exportEntrySchema = z
  .object({
    types: z.optional(z.string()),
    source: z.optional(z.string()),
    development: z.optional(z.string()),
    browser: z.optional(
      z.object({
        source: z.string(),
        import: z.optional(z.string()),
        require: z.optional(z.string()),
      }),
    ),
    node: z.optional(
      z.object({
        source: z.optional(z.string()),
        import: z.optional(z.string()),
        require: z.optional(z.string()),
      }),
    ),
    import: z.optional(z.string()),
    require: z.optional(z.string()),
    default: z.optional(z.string()),
  })
  .refine((data) => data.default || data.import || data.require, {
    message: 'Export must have either "default", "import", or "require" field',
  })

const basePkgSchema = z.object({
  type: z.enum(['commonjs', 'module']).default('commonjs'),
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
      z.union([
        z.custom<`./${string}.json`>(
          (val) => typeof val === 'string' && /^\.\/.*\.json$/.test(val),
        ),
        z.custom<`./${string}.css`>((val) => typeof val === 'string' && /^\.\/.*\.css$/.test(val)),
        exportEntrySchema,
        z.object({
          types: z.optional(z.string()),
          svelte: z.string(),
          default: z.optional(z.string()),
        }),
      ]),
    ),
  ),
  publishConfig: z.optional(
    z
      .object({
        access: z.optional(z.enum(['public', 'restricted'])),
        registry: z.optional(z.string()),
        tag: z.optional(z.string()),
        exports: z.optional(
          z.record(
            z.union([
              z.string(),
              z.object({
                types: z.optional(z.string()),
                browser: z.optional(z.record(z.string())),
                node: z.optional(z.record(z.string())),
                import: z.optional(z.string()),
                require: z.optional(z.string()),
                default: z.optional(z.string()),
                svelte: z.optional(z.string()),
              }),
            ]),
          ),
        ),
      })
      .passthrough(), // Allow any other npm config options
  ),
  browserslist: z.optional(z.union([z.string(), z.array(z.string())])),
  sideEffects: z.optional(z.union([z.boolean(), z.array(z.string())])),
  // @TODO type this properly
  typesVersions: z.optional(z.any()),
})

const pkgSchema = basePkgSchema.transform((pkg): PackageJSON => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Schema validates PackageJSON structure
  if (!pkg.exports) return pkg as PackageJSON

  const isModule = pkg.type === 'module'
  const transformedExports: PackageJSON['exports'] = {}

  for (const [key, value] of Object.entries(pkg.exports)) {
    if (typeof value === 'string') {
      transformedExports[key] = value
    } else if ('svelte' in value) {
      transformedExports[key] = value
    } else {
      // Compute default: use `import` for type: 'module', otherwise `require`
      // The refine guarantees at least one of default/import/require exists
      const computedDefault = isModule
        ? (value.import ?? value.require)!
        : (value.require ?? value.import)!

      transformedExports[key] = {
        ...value,
        default: value.default ?? computedDefault,
      }
    }
  }

  // oxlint-disable-next-line no-unsafe-type-assertion
  return {...pkg, exports: transformedExports} as PackageJSON
})

/**
 * A map over known keys to catch casing mistakes
 * @internal
 */
export const typoMap: Map<string, string> = new Map()

for (const key of basePkgSchema.keyof()._def.values) {
  typoMap.set(key.toUpperCase(), key)
}

/**
 * @public
 */
export function parsePackage(input: unknown): PackageJSON {
  return pkgSchema.parse(input)
}
