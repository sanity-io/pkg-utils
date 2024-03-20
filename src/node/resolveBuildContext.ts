import browserslistToEsbuild from 'browserslist-to-esbuild'
import path from 'path'

import {
  type BuildContext,
  DEFAULT_BROWSERSLIST_QUERY,
  loadTSConfig,
  type PackageJSON,
  parseExports,
  type PkgConfigOptions,
  type PkgExports,
  type PkgRuntime,
  resolveConfigProperty,
} from './core'
import {findCommonDirPath, pathContains} from './core/findCommonPath'
import type {Logger} from './logger'
import {resolveBrowserTarget} from './resolveBrowserTarget'
import {resolveNodeTarget} from './resolveNodeTarget'

export async function resolveBuildContext(options: {
  config?: PkgConfigOptions
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

  /* eslint-disable padding-line-between-statements */
  let browserslist = pkg.browserslist
  if (!browserslist) {
    if (strict) {
      logger.warn(
        'Could not detect a `browserslist` property in `package.json`, using default configuration. Add `"browserslist": "extends @sanity/browserslist-config"` to silence this warning.',
      )
    }
    browserslist = DEFAULT_BROWSERSLIST_QUERY
  }
  const targetVersions = browserslistToEsbuild(browserslist)
  /* eslint-enable padding-line-between-statements */

  if (strict && typeof pkg.sideEffects === 'undefined') {
    logger.error(
      'No `sideEffects` field in `package.json`, assuming all files are side-effectful. Add `"sideEffects": true` to silence this warning. See https://webpack.js.org/guides/tree-shaking/#clarifying-tree-shaking-and-sideeffects for how to define `sideEffects`.',
    )
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

  const parsedExports = parseExports({
    pkg,
    strict,
    legacyExports: config?.legacyExports ?? false,
  }).reduce<PkgExports>((acc, x) => {
    const {_path: exportPath, ...exportEntry} = x

    return {...acc, [exportPath]: exportEntry}
  }, {})

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

  const outputPaths = Object.values(exports)
    .flatMap((exportEntry) => {
      return [
        exportEntry.import,
        exportEntry.require,
        exportEntry.browser?.import,
        exportEntry.browser?.require,
        exportEntry.node?.source && exportEntry.node.import,
        exportEntry.node?.source && exportEntry.node.require,
      ].filter(Boolean) as string[]
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
  }

  return ctx
}
