import path from 'node:path'
import type {PackageJSON} from '@sanity/parse-package-json'
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

  if (strictOptions.noCheckTypes !== 'off' && tsconfig?.options && config?.dts !== 'rolldown') {
    if (
      tsconfig.options.noCheck !== false &&
      !tsconfig.options.noCheck &&
      config?.extract?.checkTypes !== false
    ) {
      if (strictOptions.noCheckTypes === 'error') {
        throw new Error(
          '`noCheck` is not set to `true` in the tsconfig.json file used by `package.config.ts`. This makes generating dts files slower than it needs to be, as it will perform type checking on the dts files while at it. You can set `noCheck: true` in tsconfig.json or set `extract: { checkTypes: false }` in package.config.ts to disable type checking.',
        )
      } else {
        logger.warn(
          '`noCheck` is not set to `true` in the tsconfig.json file used by `package.config.ts`. This makes generating dts files slower than it needs to be, as it will perform type checking on the dts files while at it. You can set `noCheck: true` in tsconfig.json or set `extract: { checkTypes: false }` in package.config.ts to disable type checking.',
        )
      }
    }
  }

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

  const parsedExports = (
    await parseAndValidateExports({
      cwd,
      pkg,
      strict,
      strictOptions,
      logger,
    })
  ).reduce<PkgExports>(
    (acc, {_path: exportPath, ...exportEntry}) => Object.assign(acc, {[exportPath]: exportEntry}),
    {},
  )

  const exports = resolveConfigProperty(config?.exports, parsedExports)

  const parsedExternal = [
    ...(pkg.dependencies ? Object.keys(pkg.dependencies) : []),
    ...(pkg.peerDependencies ? Object.keys(pkg.peerDependencies) : []),
  ]

  // Merge externals if an array is provided, replace if it's a function
  const external =
    config && Array.isArray(config.external)
      ? [...parsedExternal, ...config.external]
      : resolveConfigProperty(config?.external, parsedExternal)
  // Merge bundledPackages with dev deps, replace if it's a function
  const externalWithTypes = new Set([pkg.name, ...external, ...external.map(transformPackageName)])
  const bundledDependencies = (pkg.devDependencies ? Object.keys(pkg.devDependencies) : []).filter(
    // Do not bundle anything that is marked as external
    (_) => !externalWithTypes.has(_),
  )
  const bundledPackages =
    config && Array.isArray(config.extract?.bundledPackages)
      ? [...bundledDependencies, ...config.extract.bundledPackages]
      : resolveConfigProperty(config?.extract?.bundledPackages, bundledDependencies)

  const outputPaths = Object.values(exports)
    .flatMap((exportEntry) => {
      return [
        exportEntry.import,
        exportEntry.require,
        exportEntry.browser?.import,
        exportEntry.browser?.require,
        exportEntry.node?.source && exportEntry.node.import,
        exportEntry.node?.source && exportEntry.node.require,
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
    distPath,
    emitDeclarationOnly,
    exports,
    external,
    bundledPackages,
    files: [],
    logger,
    pkg,
    runtime: config?.runtime ?? '*',
    strict,
    target,
    ts: {
      config: tsconfig,
      configPath: tsconfigPath,
    },
    dts: config?.dts === 'rolldown' ? 'rolldown' : 'api-extractor',
  }

  return ctx
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
