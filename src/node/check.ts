import path from 'path'
import esbuild, {BuildFailure} from 'esbuild'
import {_loadConfig, _loadPkgWithReporting} from './_core'
import {_fileExists, _printPackageTree} from './_printPackageTree'
import {_resolveBuildContext} from './_resolveBuildContext'

/** @public */
export async function check(options: {
  cwd: string
  strict?: boolean
  tsconfig?: string
}): Promise<void> {
  const {cwd, strict, tsconfig = 'tsconfig.json'} = options

  const pkg = await _loadPkgWithReporting({cwd})
  const config = await _loadConfig({cwd})
  const ctx = await _resolveBuildContext({config, cwd, pkg, tsconfig})
  const {logger} = ctx

  _printPackageTree(ctx)

  if (strict) {
    const missingFiles: string[] = []

    // Check if there are missing files
    for (const [, exp] of Object.entries(ctx.exports || {})) {
      if (exp.source && !_fileExists(path.resolve(cwd, exp.source))) {
        missingFiles.push(exp.source)
      }

      if (exp.require && !_fileExists(path.resolve(cwd, exp.require))) {
        missingFiles.push(exp.require)
      }

      if (exp.import && !_fileExists(path.resolve(cwd, exp.import))) {
        missingFiles.push(exp.import)
      }

      if (exp.types && !_fileExists(path.resolve(cwd, exp.types))) {
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
