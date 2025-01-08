import {z} from 'zod'

import type {PackageJSON} from './types'

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
      z.union([
        z.custom<`./${string}.json`>((val) => /^\.\/.*\.json$/.test(val as string)),
        z.custom<`./${string}.css`>((val) => /^\.\/.*\.css$/.test(val as string)),
        z.object({
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
          default: z.string(),
        }),
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

// Create a map over known keys to catch casing mistakes
const typoMap = new Map<string, string>()

for (const key of pkgSchema.keyof()._def.values) {
  typoMap.set(key.toUpperCase(), key)
}

export function validatePkg(input: unknown): PackageJSON {
  const pkg = pkgSchema.parse(input)

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
