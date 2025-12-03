import type {PackageJSON} from '@sanity/parse-package-json'
import {z} from 'zod/v3'

const exportEntrySchema = z
  .object({
    types: z.optional(z.string()),
    source: z.optional(z.string()),
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

  return {...pkg, exports: transformedExports} as PackageJSON
})

// Create a map over known keys to catch casing mistakes
const typoMap = new Map<string, string>()

for (const key of basePkgSchema.keyof()._def.values) {
  typoMap.set(key.toUpperCase(), key)
}

export function validatePkg(input: unknown): PackageJSON {
  const pkg = pkgSchema.parse(input)

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Need to check raw input for typos
  const invalidKey = Object.keys(input as PackageJSON).find((key) => {
    const needle = key.toUpperCase()

    return typoMap.has(needle) ? typoMap.get(needle) !== key : false
  })

  if (invalidKey) {
    throw new TypeError(
      `
- package.json: "${invalidKey}" is not a valid key. Did you mean "${typoMap.get(invalidKey.toUpperCase())}"?`,
    )
  }

  return pkg
}
