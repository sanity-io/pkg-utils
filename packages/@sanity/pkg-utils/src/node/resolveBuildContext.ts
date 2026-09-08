import path from 'node:path'
import {parseCssExports, type PackageJSON} from '@sanity/parse-package-json'
import browserslistToEsbuild from 'browserslist-to-esbuild'
import {resolveConfigProperty} from './core/config/resolveConfigProperty.ts'
import {type PkgConfigOptions, type PkgExports, type PkgRuntime} from './core/config/types.ts'
import type {BuildContext} from './core/contexts/buildContext.ts'
import {DEFAULT_BROWSERSLIST_QUERY} from './core/defaults.ts'
import {findCommonDirPath, pathContains} from './core/findCommonPath.ts'
import {parseAndValidateExports} from './core/pkg/parseAndValidateExports.ts'
import {loadTSConfig} from './core/ts/loadTSConfig.ts'
import type {Logger} from './logger.ts'
import {resolveBrowserTarget} from './resolveBrowserTarget.ts'
import {resolveNodeTarget} from './resolveNodeTarget.ts'
import {parseStrictOptions} from './strict.ts'

// Type guard to filter out falsy values
function isTruthy<T>(value: T | false | null | undefined | 0 | ''): value is T {
  return Boolean(value)
}

export async function resolveBuildContext(options: {
  config?: PkgConfigOptions | undefined
  cwd: string
  emitDeclarationOnly?: boolean
  logger: Logger
  pkg: PackageJSON
  strict: boolean
  tsconfig: string
}): Promise<BuildContext> {
  const {
    config,
    cwd,
    emitDeclarationOnly = false,
    logger,
    pkg,
    strict,
    tsconfig: tsconfigPath,
  } = options
  const tsconfig = await loadTSConfig({cwd, tsconfigPath})
  const strictOptions = parseStrictOptions(config?.strictOptions ?? {})

  let browserslist = pkg.browserslist
  if (!browserslist) {
    if (strict && strictOptions.noImplicitBrowsersList !== 'off') {
      if (strictOptions.noImplicitBrowsersList === 'error') {
        throw new Error(
          '\n- ' +
            `package.json: "browserslist" is missing, set it to \`"browserslist": "extends @sanity/browserslist-config"\``,
        )
      } else {
        logger.warn(
          'Could not detect a `browserslist` property in `package.json`, using default configuration. Add `"browserslist": "extends @sanity/browserslist-config"` to silence this warning.',
        )
      }
    }
    browserslist = DEFAULT_BROWSERSLIST_QUERY
  }
  const targetVersions = browserslistToEsbuild(browserslist)

  if (
    strict &&
    strictOptions.noImplicitSideEffects !== 'off' &&
    typeof pkg.sideEffects === 'undefined'
  ) {
    const msg =
      'package.json: `sideEffects` is missing, see https://webpack.js.org/guides/tree-shaking/#clarifying-tree-shaking-and-sideeffects for how to define `sideEffects`'

    if (strictOptions.noImplicitSideEffects === 'error') {
      throw new Error(msg)
    } else {
      logger.warn(msg)
    }
  }

  const nodeTarget = resolveNodeTarget(targetVersions)
  const webTarget = resolveBrowserTarget(targetVersions)

  if (!nodeTarget) {
    throw new Error('no matching `node` target')
  }

  if (!webTarget) {
    throw new Error('no matching `web` target')
  }

  const target: Record<PkgRuntime, string[]> = {
    '*': webTarget.concat(nodeTarget),
    'browser': webTarget,
    'node': nodeTarget,
  }

  const parsedExports = parseAndValidateExports({
    cwd,
    pkg,
    strict,
    strictOptions,
    logger,
  }).reduce<PkgExports>(
    (acc, {_path: exportPath, ...exportEntry}) => Object.assign(acc, {[exportPath]: exportEntry}),
    {},
  )

  const exports = resolveConfigProperty(config?.exports, parsedExports)

  const cssExports = parseCssExports({pkg})

  const parsedExternal = [
    ...(pkg.dependencies ? Object.keys(pkg.dependencies) : []),
    ...(pkg.peerDependencies ? Object.keys(pkg.peerDependencies) : []),
  ]

  // The deprecated (grandfathered) `external` option: merge if an array, replace if a function
  const external =
    config && Array.isArray(config.external)
      ? [...parsedExternal, ...config.external]
      : resolveConfigProperty(config?.external, parsedExternal)

  // Map `external` onto tsdown's `deps`: additions over the default (dependencies + peers)
  // become `neverBundle`, defaults filtered out by the callback pattern become `alwaysBundle`
  // (tsdown auto-externalizes dependencies/peers, so only the diff needs expressing). The v11
  // `external` semantics were subpath-aware (`name` also matched `name/subpath`), so package
  // names map to `^name(/|$)` patterns. The package's own name always stays external, so
  // self-referencing imports (e.g. the injected `import "<pkg>/bundle.css"`) never resolve
  // into the bundle.
  const packagePattern = (name: string) => new RegExp(`^${escapeRegExp(name)}(/|$)`)
  const neverBundleAdditions: (string | RegExp)[] = external
    .filter((name) => !parsedExternal.includes(name))
    .map(packagePattern)
  neverBundleAdditions.push(packagePattern(pkg.name))
  const alwaysBundleNames = parsedExternal.filter((name) => !external.includes(name))
  const deps = mergeDeps(config?.deps, {
    neverBundle: neverBundleAdditions,
    alwaysBundle: alwaysBundleNames.map(packagePattern),
  })

  // Packages whose types are inlined into the emitted declarations, used by the TSDoc check
  // (`tsdoc.bundledPackages`): devDependencies that are not external (like v11), plus any
  // string entries of the `deps.alwaysBundle` passthrough (force-bundled deps inline types too).
  const externalWithTypes = new Set([pkg.name, ...external, ...external.map(transformPackageName)])
  const bundledDependencies = (pkg.devDependencies ? Object.keys(pkg.devDependencies) : []).filter(
    // Do not bundle anything that is marked as external
    (_) => !externalWithTypes.has(_),
  )
  const bundledPackages = [
    ...bundledDependencies,
    ...alwaysBundleNames,
    ...(Array.isArray(config?.deps?.alwaysBundle)
      ? config.deps.alwaysBundle.filter((entry): entry is string => typeof entry === 'string')
      : typeof config?.deps?.alwaysBundle === 'string'
        ? [config.deps.alwaysBundle]
        : []),
  ]

  const outputPaths = Object.values(exports)
    .flatMap((exportEntry) => {
      return [
        exportEntry.import,
        exportEntry.require,
        exportEntry.browser?.import,
        exportEntry.browser?.require,
        exportEntry.browser?.default,
        exportEntry.node?.source && exportEntry.node.import,
        exportEntry.node?.source && exportEntry.node.require,
        exportEntry.node?.default,
      ].filter(isTruthy)
    })
    .map((p) => path.resolve(cwd, p))

  const commonDistPath = findCommonDirPath(outputPaths)

  if (commonDistPath === cwd) {
    throw new Error(
      'all output files must share a common parent directory which is not the root package directory',
    )
  }

  if (commonDistPath && !pathContains(cwd, commonDistPath)) {
    throw new Error('all output files must be located within the package')
  }

  const configDistPath = config?.dist ? path.resolve(cwd, config.dist) : undefined

  if (
    configDistPath &&
    commonDistPath &&
    configDistPath !== commonDistPath &&
    !pathContains(configDistPath, commonDistPath)
  ) {
    logger.log(`did you mean to configure \`dist: './${path.relative(cwd, commonDistPath)}'\`?`)

    throw new Error('all output files must be located with the configured `dist` path')
  }

  const distPath = configDistPath || commonDistPath

  if (!distPath) {
    throw new Error('could not detect `dist` path')
  }

  const ctx: BuildContext = {
    config,
    cwd,
    deps,
    distPath,
    emitDeclarationOnly,
    exports,
    cssExports,
    external,
    bundledPackages,
    logger,
    pkg,
    runtime: config?.runtime ?? '*',
    strict,
    target,
    ts: {
      config: tsconfig,
      configPath: tsconfigPath,
    },
  }

  return ctx
}

type DepsConfig = NonNullable<import('tsdown').UserConfig['deps']>

/**
 * Merges the `deps` additions derived from the deprecated `external` option (and the
 * self-reference external) into the userland `deps` passthrough. Array forms concatenate, a
 * userland function is composed with the derived additions (the additions carry pipeline
 * invariants like the self-reference external, which must survive customization — the same
 * composition `@sanity/tsdown-config` applies to its `/^node:/` default), and a blanket
 * `true` (externalize all of `node_modules`) wins as the broadest request.
 * @internal Exported for tests.
 */
export function mergeDeps(
  configDeps: DepsConfig | undefined,
  additions: {neverBundle: (string | RegExp)[]; alwaysBundle: (string | RegExp)[]},
): DepsConfig | undefined {
  const userNeverBundle = configDeps?.neverBundle
  let neverBundle: DepsConfig['neverBundle']
  if (userNeverBundle === undefined) {
    neverBundle = additions.neverBundle
  } else if (userNeverBundle === true) {
    neverBundle = userNeverBundle
  } else if (typeof userNeverBundle === 'function') {
    const patterns = additions.neverBundle
    neverBundle = (id, importer, isResolved) =>
      patterns.some((pattern) =>
        typeof pattern === 'string' ? pattern === id : pattern.test(id),
      ) || userNeverBundle(id, importer, isResolved)
  } else if (Array.isArray(userNeverBundle)) {
    neverBundle = [...additions.neverBundle, ...userNeverBundle]
  } else {
    neverBundle = [...additions.neverBundle, userNeverBundle]
  }

  const userAlwaysBundle = configDeps?.alwaysBundle
  let alwaysBundle: DepsConfig['alwaysBundle']
  if (userAlwaysBundle === undefined) {
    alwaysBundle = additions.alwaysBundle.length ? additions.alwaysBundle : undefined
  } else if (typeof userAlwaysBundle === 'function') {
    // A userland function wins over the derived additions
    alwaysBundle = userAlwaysBundle
  } else if (Array.isArray(userAlwaysBundle)) {
    alwaysBundle = [...additions.alwaysBundle, ...userAlwaysBundle]
  } else {
    alwaysBundle = [...additions.alwaysBundle, userAlwaysBundle]
  }

  const deps: DepsConfig = {
    ...configDeps,
    neverBundle,
    ...(alwaysBundle === undefined ? {} : {alwaysBundle}),
  }

  return deps
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function transformPackageName(packageName: string): string {
  if (packageName.startsWith('@types/')) {
    // If it already starts with @types, return it as is
    return packageName
  } else if (packageName.startsWith('@')) {
    // Handle scoped packages
    const [scope, name] = packageName.split('/')

    return `@types/${scope?.slice(1)}__${name}`
  } else {
    // Handle regular packages
    return `@types/${packageName}`
  }
}
