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
    noPackageJsonBrowser: toggle.default('warn'),
    noPackageJsonTypesVersions: toggle.default('warn'),
    preferModuleType: toggle.default('warn'),
    noPublishConfigExports: toggle.default('warn'),
    noReactIsPeerDependency: toggle.default('error'),
    noSanityUiPeerDependency: toggle.default('error'),
    noSanityIconsPeerDependency: toggle.default('error'),
    noSanityDependency: toggle.default('error'),
    noStyledComponentsDependency: toggle.default('error'),
    noReactDependency: toggle.default('error'),
    noReactDomDependency: toggle.default('error'),
    noReactTypesDependency: toggle.default('error'),
    noReactDomTypesDependency: toggle.default('error'),
    noNodeTypesDependency: toggle.default('error'),
    noRxjsPeerDependency: toggle.default('error'),
    noSanityClientPeerDependency: toggle.default('error'),
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
  /**
   * Warns if `publishConfig.exports` is missing when `source` or `monorepo` conditions are used in exports.
   *
   * A missing `publishConfig.exports` is always an error when `development` is used because
   * publishing that condition breaks consumers whose tools select it.
   * @defaultValue 'warn'
   */
  noPublishConfigExports: ToggleType
  /**
   * Disallows `react-is` in `peerDependencies`. It should be in `dependencies` (or `devDependencies`) instead.
   * @defaultValue 'error'
   */
  noReactIsPeerDependency: ToggleType
  /**
   * Disallows `@sanity/ui` in `peerDependencies`. It should be in `dependencies` (or `devDependencies`) instead.
   * @defaultValue 'error'
   */
  noSanityUiPeerDependency: ToggleType
  /**
   * Disallows `@sanity/icons` in `peerDependencies`. It should be in `dependencies` (or `devDependencies`) instead.
   * @defaultValue 'error'
   */
  noSanityIconsPeerDependency: ToggleType
  /**
   * Disallows `sanity` in `dependencies`. It should only be in `devDependencies` and/or `peerDependencies`.
   * @defaultValue 'error'
   */
  noSanityDependency: ToggleType
  /**
   * Disallows `styled-components` in `dependencies`. It should only be in `devDependencies` and/or `peerDependencies`.
   * @defaultValue 'error'
   */
  noStyledComponentsDependency: ToggleType
  /**
   * Disallows `react` in `dependencies`. It should only be in `devDependencies` and/or `peerDependencies`.
   * @defaultValue 'error'
   */
  noReactDependency: ToggleType
  /**
   * Disallows `react-dom` in `dependencies`. It should only be in `devDependencies` and/or `peerDependencies`.
   * @defaultValue 'error'
   */
  noReactDomDependency: ToggleType
  /**
   * Disallows `@types/react` in `dependencies`. It should only be in `devDependencies` and/or `peerDependencies`, and when declared as a peer dependency the version range should be `*`.
   * @defaultValue 'error'
   */
  noReactTypesDependency: ToggleType
  /**
   * Disallows `@types/react-dom` in `dependencies`. It should only be in `devDependencies` and/or `peerDependencies`, and when declared as a peer dependency the version range should be `*`.
   * @defaultValue 'error'
   */
  noReactDomTypesDependency: ToggleType
  /**
   * Disallows `@types/node` in `dependencies`. It should only be in `devDependencies` and/or `peerDependencies`, and when declared as a peer dependency the version range should be `*`.
   * @defaultValue 'error'
   */
  noNodeTypesDependency: ToggleType
  /**
   * Disallows `rxjs` in `peerDependencies`. It should only be in `dependencies` and/or `devDependencies`.
   * @defaultValue 'error'
   */
  noRxjsPeerDependency: ToggleType
  /**
   * Disallows `@sanity/client` in `peerDependencies`. It should only be in `dependencies` and/or `devDependencies`.
   * @defaultValue 'error'
   */
  noSanityClientPeerDependency: ToggleType
}

/** @alpha */
export function parseStrictOptions(input: unknown): StrictOptions {
  return validationSchema.parse({strictOptions: input}, {errorMap}).strictOptions
}
