import path from 'path'
import chalk from 'chalk'
import {
  PkgConfigOptions,
  PkgExports,
  PkgRuntime,
  _BuildContext,
  _DEFAULTS,
  // _loadConfig,
  // _loadPkgWithReporting,
  _loadTSConfig,
  _PackageJSON,
  _parseExports,
  _resolveConfigProperty,
} from './_core'
import {_resolveBrowserslistVersions} from './_resolveBrowserslistVersions'
import {_resolveBrowserTarget} from './_resolveBrowserTarget'
import {_resolveNodeTarget} from './_resolveNodeTarget'

export async function _resolveBuildContext(options: {
  config?: PkgConfigOptions
  cwd: string
  pkg: _PackageJSON
  tsconfig: string
}): Promise<_BuildContext> {
  const {config, cwd, pkg, tsconfig: tsconfigPath} = options

  const tsconfig = await _loadTSConfig({cwd, tsconfigPath})

  const targetVersions = _resolveBrowserslistVersions(pkg.browserslist || _DEFAULTS.browserslist)

  const srcPath = path.resolve(cwd, config?.src || 'src')
  const distPath = path.resolve(cwd, config?.dist || 'dist')

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

  const external = _resolveConfigProperty(config?.external, parsedExternal)

  const ctx: _BuildContext = {
    config,
    cwd,
    dist: path.relative(cwd, distPath),
    exports,
    external,
    files: [],
    logger: {
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
    },
    pkg,
    src: path.relative(cwd, srcPath),
    runtime: config?.runtime ?? '*',
    target,
    ts: {
      config: tsconfig,
      configPath: tsconfigPath,
    },
  }

  return ctx
}
