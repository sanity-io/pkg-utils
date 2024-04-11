import {z} from 'zod'
import {errorMap} from 'zod-validation-error'

/**
 * @public
 */
export const toggle = z.union([z.literal('error'), z.literal('warn'), z.literal('off')])

/**
 * @public
 */
export type ToggleType = z.infer<typeof toggle>

/**
 * @public
 */
export const strictOptions = z
  .object({
    noPackageJsonTypings: toggle.default('error'),
    noImplicitSideEffects: toggle.default('warn'),
    noImplicitBrowsersList: toggle.default('warn'),
  })
  .strict()

/**
 * To make error message paths line up with the paths in package.config.ts the schema is hoisted into a root schema
 * This way errors will say `Expected boolean, received string at "strict.noPackageJsonTypings"` instead of `Expected boolean, received string at "noPackageJsonTypings"`.
 */
const validationSchema = z.object({
  strictOptions: strictOptions.default({}),
})

/**
 * @public
 */
export type InferredStrictOptions = z.infer<typeof strictOptions>

/**
 * @public
 */
export interface StrictOptions {
  /**
   * Disallows a top level `typings` field in `package.json` if it is equal to `exports['.'].source`.
   * @defaultValue 'error'
   */
  noPackageJsonTypings?: ToggleType
  /**
   * Requires specifying `sideEffects` in `package.json`.
   * @defaultValue 'warn'
   */
  noImplicitSideEffects?: ToggleType
  /**
   * Requires specifying `browserslist` in `package.json`, instead of relying on it implicitly being:
   * @example
   * ```
   * "browserslist": "extends @sanity/browserslist-config"
   * ```
   * @defaultValue 'warn'
   */
  noImplicitBrowsersList?: ToggleType
}

/** @internal */
export function parseStrictOptions(input: unknown): InferredStrictOptions {
  return validationSchema.parse({strictOptions: input}, {errorMap}).strictOptions
}
