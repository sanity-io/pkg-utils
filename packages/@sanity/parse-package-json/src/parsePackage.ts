import {z} from 'zod/v3'
import type {PackageJSON} from './types'

const exportEntrySchema = z
  .object({
    types: z.optional(z.string()),
    source: z.optional(z.string()),
    development: z.optional(z.string()),
    monorepo: z.optional(z.string()),
    browser: z.optional(
      z.object({
        source: z.string(),
        import: z.optional(z.string()),
        require: z.optional(z.string()),
        default: z.optional(z.string()),
      }),
    ),
    node: z.optional(
      z.object({
        source: z.optional(z.string()),
        import: z.optional(z.string()),
        require: z.optional(z.string()),
        default: z.optional(z.string()),
      }),
    ),
    import: z.optional(z.string()),
    require: z.optional(z.string()),
    default: z.optional(z.string()),
  })
  .refine((data) => data.default || data.import || data.require, {
    message: 'Export must have either "default", "import", or "require" field',
  })

/**
 * Conditional export for a CSS file, e.g.
 * ```json
 * "./bundle.css": {
 *   "types": "./dist/bundle-css.d.ts",
 *   "browser": "./dist/bundle.css",
 *   "node": "./dist/bundle-css.js",
 *   "default": "./dist/bundle-css.js"
 * }
 * ```
 * This lets a package re-add a `import "<pkg>/bundle.css"` statement that resolves to the real CSS
 * file in bundler/browser environments, while resolving to a no-op JS shim in runtimes (like Node)
 * that cannot import `.css` files directly.
 *
 * It is intentionally a flat map of condition name -> relative path string. Only `.css` subpaths
 * are validated against it (see {@link exportSchemaFor}), and at least one of the resolved targets
 * must be a `.css` file - otherwise `import "<pkg>/bundle.css"` resolves to something that isn't a
 * stylesheet in every environment.
 */
const cssExportConditionsSchema = z
  .record(z.string(), z.string())
  .refine((data) => Object.values(data).some((value) => value.endsWith('.css')), {
    message: 'A conditional export for a ".css" subpath must resolve to at least one ".css" file',
  })

/**
 * A `svelte` entry is not built by the pipeline, so the rest of its conditions are the author's to
 * keep: it is validated, then passed through as authored.
 */
const svelteExportSchema = z
  .object({
    types: z.optional(z.string()),
    svelte: z.string(),
    default: z.optional(z.string()),
  })
  .passthrough()

/**
 * A subpath that ships a file as-is instead of building it, declared as a plain string. Every
 * other subpath is a build entry, which needs its conditions (and its `source`) spelled out.
 */
const passthroughExportSchema = z.custom<`./${string}.json` | `./${string}.css`>(
  (val) => typeof val === 'string' && /^\.\/.*\.(json|css)$/.test(val),
  {
    message:
      'A string export target must be a ".json" or ".css" file that ships as-is. Other subpaths are build entries and must declare their conditions, including "source"',
  },
)

/**
 * A runtime condition (`browser`, `node`) nests the module-format conditions of that runtime, but
 * may be condensed to a plain string when there is only one target left to resolve to - the
 * resolver treats `"node": "./dist/index.node.js"` and `"node": {"default": "./dist/index.node.js"}`
 * identically.
 */
const publishRuntimeConditionSchema = z.union([z.string(), z.record(z.string(), z.string())], {
  errorMap: () => ({
    message: 'A runtime condition must be a path string, or a map of condition name -> path string',
  }),
})

const publishExportEntrySchema = z.object({
  types: z.optional(z.string()),
  browser: z.optional(publishRuntimeConditionSchema),
  node: z.optional(publishRuntimeConditionSchema),
  import: z.optional(z.string()),
  require: z.optional(z.string()),
  default: z.optional(z.string()),
  svelte: z.optional(z.string()),
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

/**
 * The schema an export subpath is validated against. The subpath decides which shape is expected:
 * a `.css` subpath carries a flat condition -> path map, everything else is a regular export entry.
 * Dispatching up front - instead of trying every shape and reporting whichever error looks closest -
 * is what keeps a malformed entry from being reported as a malformed CSS export.
 */
function exportSchemaFor(
  exportPath: string,
  value: unknown,
  entrySchema: z.ZodTypeAny,
  stringSchema: z.ZodTypeAny,
): z.ZodTypeAny {
  if (typeof value === 'string') return stringSchema
  if (exportPath.endsWith('.css')) return cssExportConditionsSchema
  if (isRecord(value) && 'svelte' in value) return svelteExportSchema
  return entrySchema
}

/**
 * An `exports` map, with each subpath validated against the shape its name implies. The parsed
 * values are kept as-is (the record cannot type them per key), and narrowed by the consumers.
 */
function exportsMapSchema(entrySchema: z.ZodTypeAny, stringSchema: z.ZodTypeAny) {
  return z.record(z.string(), z.unknown()).transform((exportsMap, ctx) => {
    const parsed: Record<string, unknown> = {}

    for (const [exportPath, value] of Object.entries(exportsMap)) {
      const result = exportSchemaFor(exportPath, value, entrySchema, stringSchema).safeParse(value)

      if (result.success) {
        parsed[exportPath] = result.data
        continue
      }

      for (const issue of result.error.issues) {
        ctx.addIssue({...issue, path: [exportPath, ...issue.path]})
      }
    }

    return parsed
  })
}

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
  exports: z.optional(exportsMapSchema(exportEntrySchema, passthroughExportSchema)),
  publishConfig: z.optional(
    z
      .object({
        access: z.optional(z.enum(['public', 'restricted'])),
        registry: z.optional(z.string()),
        tag: z.optional(z.string()),
        // A publish map holds no `source`, so a single-target entry may be a plain string
        exports: z.optional(exportsMapSchema(publishExportEntrySchema, z.string())),
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
  // Built loosely and asserted to `PackageJSON` on return - CSS exports may be a conditional object
  // (a flat condition -> path map) which the public `PackageJSON` type models as a plain string.
  const transformedExports: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(pkg.exports)) {
    // Strings, conditional CSS exports (a flat map of condition -> path, for which no `default`
    // is computed) and svelte entries pass through untouched.
    if (!isRecord(value) || key.endsWith('.css') || 'svelte' in value) {
      transformedExports[key] = value
      continue
    }

    // Compute default: use `import` for type: 'module', otherwise `require`
    // The refine guarantees at least one of default/import/require exists
    const importTarget = asString(value['import'])
    const requireTarget = asString(value['require'])
    const computedDefault = isModule
      ? (importTarget ?? requireTarget)
      : (requireTarget ?? importTarget)

    transformedExports[key] = {
      ...value,
      default: asString(value['default']) ?? computedDefault,
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
