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
        z.object({
          types: z.optional(z.string()),
          source: z.string(),
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
})

export function validatePkg(input: unknown): PackageJSON {
  return pkgSchema.parse(input)
}
