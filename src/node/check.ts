import esbuild, {BuildFailure} from 'esbuild'
import path from 'path'

import {getPkgExtMap, loadConfig, loadPkgWithReporting} from './core'
import {fileExists} from './fileExists'
import {createLogger} from './logger'
import {printPackageTree} from './printPackageTree'
import {resolveBuildContext} from './resolveBuildContext'

/** @public */
export async function check(options: {
  cwd: string
  strict?: boolean
  tsconfig?: string
}): Promise<void> {
  const {cwd, strict = false, tsconfig: tsconfigOption} = options
  const logger = createLogger()

  const pkg = await loadPkgWithReporting({cwd, logger})
  const config = await loadConfig({cwd})
  const extMap = getPkgExtMap({legacyExports: config?.legacyExports ?? false})
  const tsconfig = tsconfigOption || config?.tsconfig || 'tsconfig.json'
  const ctx = await resolveBuildContext({config, cwd, extMap, logger, pkg, strict, tsconfig})

  printPackageTree(ctx)

  if (strict) {
    const missingFiles: string[] = []

    // Check if there are missing files
    for (const [, exp] of Object.entries(ctx.exports || {})) {
      if (exp.source && !fileExists(path.resolve(cwd, exp.source))) {
        missingFiles.push(exp.source)
      }

      if (exp.require && !fileExists(path.resolve(cwd, exp.require))) {
        missingFiles.push(exp.require)
      }

      if (exp.import && !fileExists(path.resolve(cwd, exp.import))) {
        missingFiles.push(exp.import)
      }

      if (exp.types && !fileExists(path.resolve(cwd, exp.types))) {
        missingFiles.push(exp.types)
      }
    }

    if (missingFiles.length) {
      logger.error('missing files')
      process.exit(1)
    }

    // Check if the files are resolved
    const _paths: {require: string[]; import: string[]} = {
      require: [],
      import: [],
    }

    for (const exp of Object.values(ctx.exports || {})) {
      if (!exp._exported) continue
      if (exp.require) _paths.require.push(exp.require)
      if (exp.import) _paths.import.push(exp.import)
    }

    const external = Object.keys(pkg.dependencies || {}).concat(
      Object.keys(pkg.devDependencies || {})
    )

    if (_paths.import.length) {
      const code = _paths.import.map((id) => `import('${id}')`).join('\n')

      try {
        const esbuildResult = await esbuild.build({
          external,
          stdin: {
            contents: code,
            loader: 'js',
            resolveDir: cwd,
          },
          format: 'esm',
          bundle: true,
          logLevel: 'silent',
          // otherwise output maps to stdout as we're using stdin
          outfile: '/dev/null',
          platform: 'node',
        })

        if (esbuildResult.warnings.length > 0) {
          logger.warn(...esbuildResult.warnings)
        }
      } catch (err) {
        const {errors} = err as BuildFailure

        for (const _err of errors) {
          if (_err.location) {
            logger.error(_err.detail || _err.text)
            logger.error(`${_err.location.line} | ${_err.location.lineText}`)
            logger.error(
              'in',
              `./${_err.location.file}:${_err.location.line}:${_err.location.column}`
            )
          } else {
            logger.error(_err.detail || _err.text)
          }

          logger.log()
        }

        process.exit(1)
      }
    }

    if (_paths.require.length) {
      const code = _paths.require.map((id) => `require('${id}')`).join('\n')

      const esbuildResult = await esbuild.build({
        external,
        stdin: {
          contents: code,
          loader: 'js',
          resolveDir: cwd,
        },
        format: 'cjs',
        bundle: true,
        // otherwise output maps to stdout as we're using stdin
        outfile: '/dev/null',
        platform: 'node',
      })

      if (esbuildResult.errors.length > 0) {
        // throw new Error(esbuildResult.errors.join(', '))
        logger.error(esbuildResult.errors.join(', '))
        process.exit(1)
      }

      if (esbuildResult.warnings.length > 0) {
        logger.warn(...esbuildResult.warnings)
      }
    }
  }
}
