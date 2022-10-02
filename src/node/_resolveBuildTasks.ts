import fs from 'fs'
import path from 'path'
import {PkgExport, PkgFormat, PkgRuntime, _BuildContext, _MODULE_EXT} from './_core'
import {_BuildTask, _DtsTask, _RollupTask, _RollupTaskEntry} from './_tasks'

/** @internal */
export function _resolveBuildTasks(ctx: _BuildContext): _BuildTask[] {
  const {config, cwd, pkg, target} = ctx

  const bundles = config?.bundles || []

  const tasks: _BuildTask[] = []

  const exports = Object.entries(ctx.exports || {}).map(
    ([_path, exp]) => ({_path, ...exp} as PkgExport & {_path: string})
  )

  const dtsTask: _DtsTask = {
    type: 'build:dts',
    entries: [],
  }

  const rollupTasks: Record<string, _RollupTask> = {}

  function _addRollupTaskEntry(format: PkgFormat, runtime: PkgRuntime, entry: _RollupTaskEntry) {
    const buildId = `${format}:${runtime}`

    if (rollupTasks[buildId]) {
      rollupTasks[buildId].entries.push(entry)
    } else {
      rollupTasks[buildId] = {
        type: 'build:js',
        buildId,
        entries: [entry],
        runtime,
        format,
        target: target[runtime],
      }
    }
  }

  // Parse `dts` tasks
  for (const exp of exports) {
    const importId = path.join(pkg.name, exp._path)

    if (exp.types) {
      dtsTask.entries.push({
        importId,
        exportPath: exp._path,
        sourcePath: exp.source,
        targetPath: exp.types,
      })
    }
  }

  // Parse rollup:commonjs:* tasks
  for (const exp of exports) {
    const output = exp.require

    if (!output) continue

    _addRollupTaskEntry('commonjs', ctx.runtime, {
      path: exp._path,
      source: exp.source,
      output,
    })
  }

  // Parse rollup:esm:* tasks
  for (const exp of exports) {
    const output = exp.import

    if (!output) continue

    _addRollupTaskEntry('esm', ctx.runtime, {
      path: exp._path,
      source: exp.source,
      output,
    })
  }

  // Parse rollup:commonjs:browser tasks
  for (const exp of exports) {
    const output = exp.browser?.require

    if (!output) continue

    _addRollupTaskEntry('commonjs', 'browser', {
      path: exp._path,
      source: exp.browser?.source || exp.source,
      output,
    })
  }

  // Parse rollup:esm:browser tasks
  for (const exp of exports) {
    const output = exp.browser?.import

    if (!output) continue

    _addRollupTaskEntry('esm', 'browser', {
      path: exp._path,
      source: exp.browser?.source || exp.source,
      output,
    })
  }

  for (const bundle of bundles) {
    if (bundle.require) {
      _addRollupTaskEntry('commonjs', bundle.runtime || ctx.runtime, {
        path: '__bundle__',
        source: bundle.source,
        output: bundle.require,
      })
    }

    if (bundle.import) {
      _addRollupTaskEntry('commonjs', bundle.runtime || ctx.runtime, {
        path: '__bundle__',
        source: bundle.source,
        output: bundle.import,
      })
    }
  }

  if (dtsTask.entries.length) {
    tasks.push(dtsTask)
  }

  tasks.push(...Object.values(rollupTasks))

  // Write legacy exports files
  if (config?.legacyExports) {
    for (const exp of exports) {
      if (exp._exported && exp._path !== '.') {
        const relativeTargetPath = (exp.browser?.import || exp.import || '').replace(
          /\.[^/.]+$/,
          ''
        )
        const ext = _MODULE_EXT[pkg.type].esm

        if (relativeTargetPath) {
          fs.writeFileSync(
            path.resolve(cwd, `${exp._path}.js`),
            [
              `// AUTO-GENERATED – DO NOT EDIT`,
              ``,
              // `export {default} from '${relativeTargetPath}'`,
              `export * from '${relativeTargetPath}${pkg.type === 'commonjs' ? ext : ''}'`,
              ``,
            ].join('\n')
          )
        }
      }
    }
  }

  return tasks
}
