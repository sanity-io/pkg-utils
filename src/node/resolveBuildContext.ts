import path from 'path'
import chalk from 'chalk'
import {
  PkgConfigOptions,
  PkgExports,
  PkgRuntime,
  BuildContext,
  DEFAULTS,
  loadTSConfig,
  PackageJSON,
  parseExports,
  resolveConfigProperty,
} from './core'
import {findCommonDirPath, pathContains} from './core/findCommonPath'
import {resolveBrowserslistVersions} from './resolveBrowserslistVersions'
import {resolveBrowserTarget} from './resolveBrowserTarget'
import {resolveNodeTarget} from './resolveNodeTarget'

function createLogger(): BuildContext['logger'] {
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

export async function resolveBuildContext(options: {
  config?: PkgConfigOptions
  cwd: string
  emitDeclarationOnly?: boolean
  pkg: PackageJSON
  strict: boolean
  tsconfig: string
}): Promise<BuildContext> {
  const {config, cwd, emitDeclarationOnly = false, pkg, strict, tsconfig: tsconfigPath} = options
  const logger = createLogger()
  const tsconfig = await loadTSConfig({cwd, tsconfigPath})
  const targetVersions = resolveBrowserslistVersions(pkg.browserslist || DEFAULTS.browserslist)
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
    browser: webTarget,
    node: nodeTarget,
  }

  const parsedExports = parseExports({pkg, strict}).reduce<PkgExports>((acc, x) => {
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
        exportEntry.node?.import,
        exportEntry.node?.require,
      ].filter(Boolean) as string[]
    })
    .map((p) => path.resolve(cwd, p))

  const commonDistPath = findCommonDirPath(outputPaths)

  if (commonDistPath === cwd) {
    throw new Error(
      'all output files must share a common parent directory which is not the root package directory'
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
