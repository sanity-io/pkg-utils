import {errorMap} from 'zod-validation-error/v3'
import {z} from 'zod/v3'

const toggle = z.union([z.literal('error'), z.literal('warn'), z.literal('off')])

type ToggleType = 'error' | 'warn' | 'off'

const strictOptions = z
  .object({
    noPackageJsonTypings: toggle.default('error'),
    noImplicitSideEffects: toggle.default('warn'),
    noImplicitBrowsersList: toggle.default('warn'),
    alwaysPackageJsonTypes: toggle.default('error'),
    alwaysPackageJsonFiles: toggle.default('error'),
    noCheckTypes: toggle.default('warn'),
    noPackageJsonMain: toggle.default('warn'),
    noPackageJsonModule: toggle.default('warn'),
    noPackageJsonBrowser: toggle.default('warn'),
    noPackageJsonTypesVersions: toggle.default('warn'),
    preferModuleType: toggle.default('warn'),
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
   * Using `.npmignore` is error prone, it's best practice to always declare `files` instead
   * @defaultValue 'error'
   */
  alwaysPackageJsonFiles: ToggleType
  /**
   * It's slow to perform type checking while generating dts files, so it's best practice to disable it with a `"noCheck": true` in the tsconfig.json file used by `package.config.ts`
   * @defaultValue 'warn'
   */
  noCheckTypes: ToggleType
  /**
   * Disallows the `main` field in `package.json` as all modern tools support the `exports` field.
   * @defaultValue 'warn'
   */
  noPackageJsonMain: ToggleType
  /**
   * Disallows the `module` field in `package.json` as all modern tools support the `exports` field.
   * @defaultValue 'warn'
   */
  noPackageJsonModule: ToggleType
  /**
   * Disallows the `browser` field in `package.json` as the `browser` condition in `exports` is better supported.
   * @defaultValue 'warn'
   */
  noPackageJsonBrowser: ToggleType
  /**
   * Disallows the `typesVersions` field in `package.json` as TypeScript has long supported conditional exports and the `types` condition.
   * @defaultValue 'warn'
   */
  noPackageJsonTypesVersions: ToggleType
  /**
   * Warns if `type` field is missing or set to `commonjs`. Future versions will require `"type": "module"`.
   * @defaultValue 'warn'
   */
  preferModuleType: ToggleType
}

/** @alpha */
export function parseStrictOptions(input: unknown): StrictOptions {
  return validationSchema.parse({strictOptions: input}, {errorMap}).strictOptions
}
