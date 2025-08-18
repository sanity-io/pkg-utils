import {errorMap} from 'zod-validation-error'
import {z} from 'zod/v3'

const toggle = z.union([z.literal('error'), z.literal('warn'), z.literal('off')])

type ToggleType = 'error' | 'warn' | 'off'

const strictOptions = z
  .object({
    noPackageJsonTypings: toggle.default('error'),
    noImplicitSideEffects: toggle.default('warn'),
    noImplicitBrowsersList: toggle.default('warn'),
    alwaysPackageJsonTypes: toggle.default('error'),
    alwaysPackageJsonMain: toggle.default('error'),
    alwaysPackageJsonFiles: toggle.default('error'),
    noCheckTypes: toggle.default('warn'),
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
export interface StrictOptions {
  /**
   * Disallows a top level `typings` field in `package.json` if it is equal to `exports['.'].source`.
   * @defaultValue 'error'
   */
  noPackageJsonTypings: ToggleType
  /**
   * Requires specifying `sideEffects` in `package.json`.
   * @defaultValue 'warn'
   */
  noImplicitSideEffects: ToggleType
  /**
   * Requires specifying `browserslist` in `package.json`, instead of relying on it implicitly being:
   * @example
   * ```
   * "browserslist": "extends @sanity/browserslist-config"
   * ```
   * @defaultValue 'warn'
   */
  noImplicitBrowsersList: ToggleType
  /**
   * If typescript is used then `types` in `package.json` should be specified for npm listings to show the TS icon.
   * @defaultValue 'error'
   */
  alwaysPackageJsonTypes: ToggleType
  /**
   * A lot of analysis tooling requiers the `main` field to work (like bundlephobia) and so it's best practice to always include it
   * @defaultValue 'error'
   */
  alwaysPackageJsonMain: ToggleType
  /**
   * Using `.npmignore` is error prone, it's best practice to always declare `files` instead
   * @defaultValue 'error'
   */
  alwaysPackageJsonFiles: ToggleType
  /**
   * It's slow to perform type checking while generating dts files, so it's best practice to disable it with a `"noCheck": true` in the tsconfig.json file used by `package.config.ts`
   * @defaultValue 'warn'
   */
  noCheckTypes: ToggleType
}

/** @alpha */
export function parseStrictOptions(input: unknown): StrictOptions {
  return validationSchema.parse({strictOptions: input}, {errorMap}).strictOptions
}
