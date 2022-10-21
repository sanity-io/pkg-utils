import path from 'path'
import chalk from 'chalk'
import {
  PkgConfigOptions,
  PkgExports,
  PkgRuntime,
  _BuildContext,
  _DEFAULTS,
  _loadTSConfig,
  _PackageJSON,
  _parseExports,
  _resolveConfigProperty,
} from './_core'
import {_findCommonDirPath, _pathContains} from './_core/_findCommonPath'
import {_resolveBrowserslistVersions} from './_resolveBrowserslistVersions'
import {_resolveBrowserTarget} from './_resolveBrowserTarget'
import {_resolveNodeTarget} from './_resolveNodeTarget'

function _createLogger(): _BuildContext['logger'] {
  return {
    /* eslint-disable no-console */
    log: (...args) => {
      console.log(...args)
    },
    info: (...args) => {
      console.log(chalk.blue('  info'), ...args)
    },
    warn: (...args) => {
      console.log(chalk.yellow('  warn'), ...args)
    },
    error: (...args) => {
      console.log(chalk.red('  fail'), ...args)
    },
    success: (...args) => {
      console.log(chalk.green('  ok  '), ...args)
    },
    /* eslint-enable no-console */
  }
}

export async function _resolveBuildContext(options: {
  config?: PkgConfigOptions
  cwd: string
  emitDeclarationOnly?: boolean
  pkg: _PackageJSON
  strict: boolean
  tsconfig: string
}): Promise<_BuildContext> {
  const {config, cwd, emitDeclarationOnly = false, pkg, strict, tsconfig: tsconfigPath} = options
  const logger = _createLogger()
  const tsconfig = await _loadTSConfig({cwd, tsconfigPath})
  const targetVersions = _resolveBrowserslistVersions(pkg.browserslist || _DEFAULTS.browserslist)
  const nodeTarget = _resolveNodeTarget(targetVersions)
  const webTarget = _resolveBrowserTarget(targetVersions)

  if (!nodeTarget) {
    throw new Error('no matching `node` target')
  }

  if (!webTarget) {
    throw new Error('no matching `web` target')
  }

  const target: Record<PkgRuntime, string[]> = {
    '*': webTarget.concat(nodeTarget),
    browser: webTarget,
    node: nodeTarget,
  }

  const parsedExports = _parseExports({pkg}).reduce<PkgExports>((acc, x) => {
    const {_path: exportPath, ...exportEntry} = x

    return {...acc, [exportPath]: exportEntry}
  }, {})

  const exports = _resolveConfigProperty(config?.exports, parsedExports)

  const parsedExternal = [
    ...(pkg.dependencies ? Object.keys(pkg.dependencies) : []),
    ...(pkg.peerDependencies ? Object.keys(pkg.peerDependencies) : []),
  ]

  // Merge externals if an array is provided, replace if it's a function
  const external =
    config && Array.isArray(config.external)
      ? [...parsedExternal, ...config.external]
      : _resolveConfigProperty(config?.external, parsedExternal)

  const outputPaths = Object.values(exports)
    .flatMap((exportEntry) => {
      return [
        exportEntry.import,
        exportEntry.require,
        exportEntry.browser?.import,
        exportEntry.browser?.require,
        exportEntry.node?.import,
        exportEntry.node?.require,
      ].filter(Boolean) as string[]
    })
    .map((p) => path.resolve(cwd, p))

  const commonDistPath = _findCommonDirPath(outputPaths)

  if (commonDistPath === cwd) {
    throw new Error(
      'all output files must share a common parent directory which is not the root package directory'
    )
  }

  if (commonDistPath && !_pathContains(cwd, commonDistPath)) {
    throw new Error('all output files must be located within the package')
  }

  const configDistPath = config?.dist ? path.resolve(cwd, config.dist) : undefined

  if (
    configDistPath &&
    commonDistPath &&
    configDistPath !== commonDistPath &&
    !_pathContains(configDistPath, commonDistPath)
  ) {
    logger.log(`did you mean to configure \`dist: './${path.relative(cwd, commonDistPath)}'\`?`)

    throw new Error('all output files must be located with the configured `dist` path')
  }

  const distPath = configDistPath || commonDistPath

  if (!distPath) {
    throw new Error('could not detect `dist` path')
  }

  const ctx: _BuildContext = {
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
