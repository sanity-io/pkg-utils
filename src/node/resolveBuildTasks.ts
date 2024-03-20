import fs from 'fs'
import path from 'path'

import type {BuildContext, PkgExport, PkgFormat, PkgRuntime} from './core'
import type {BuildTask, DtsTask, RollupTask, RollupTaskEntry} from './tasks'
import {getTargetPaths} from './tasks/dts/getTargetPaths'

/** @internal */
export function resolveBuildTasks(ctx: BuildContext): BuildTask[] {
  const {config, cwd, pkg, target} = ctx

  const bundles = config?.bundles || []

  const tasks: BuildTask[] = []

  const exports = Object.entries(ctx.exports || {}).map(
    ([_path, exp]) => ({_path, ...exp}) as PkgExport & {_path: string},
  )

  const dtsTask: DtsTask = {
    type: 'build:dts',
    entries: [],
  }

  const rollupTasks: Record<string, RollupTask> = {}

  function addRollupTaskEntry(format: PkgFormat, runtime: PkgRuntime, entry: RollupTaskEntry) {
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

    if (exp.source?.endsWith('.ts')) {
      dtsTask.entries.push({
        importId,
        exportPath: exp._path,
        sourcePath: exp.source,
        targetPaths: getTargetPaths(pkg.type, exp),
      })
    }

    if (exp.browser?.source?.endsWith('.ts')) {
      dtsTask.entries.push({
        importId,
        exportPath: exp._path,
        sourcePath: exp.browser.source,
        targetPaths: getTargetPaths(pkg.type, exp.browser),
      })
    }

    if (exp.node?.source?.endsWith('.ts')) {
      dtsTask.entries.push({
        importId,
        exportPath: exp._path,
        sourcePath: exp.node.source,
        targetPaths: getTargetPaths(pkg.type, exp.node),
      })
    }
  }

  // Handle dts tasks for bundles
  for (const bundle of bundles) {
    if (bundle.source?.endsWith('.ts')) {
      // importId needs to be how the bundle is used, like `@sanity/pkg-utils/dist/cli`
      // exportPath needs to be the path to the bundle, like `./dist/cli`
      // targetPaths is then: [./dist/cli.d.ts, ./dist/cli.d.cts]
      const exportPath = (bundle.import || bundle.require)!.replace(/\.[mc]?js$/, '')
      const importId = path.join(pkg.name, exportPath)

      dtsTask.entries.push({
        importId,
        exportPath,
        sourcePath: bundle.source,
        targetPaths: getTargetPaths(pkg.type, bundle),
      })
    }
  }

  // Add dts task
  if (dtsTask.entries.length) {
    tasks.push(dtsTask)
  }

  if (!ctx.emitDeclarationOnly) {
    // Parse rollup:commonjs:* tasks
    for (const exp of exports) {
      const output = exp.require

      if (!output) continue

      addRollupTaskEntry('commonjs', ctx.runtime, {
        path: exp._path,
        source: exp.source,
        output,
      })
    }

    // Parse rollup:esm:* tasks
    for (const exp of exports) {
      const output = exp.import

      if (!output) continue

      addRollupTaskEntry('esm', ctx.runtime, {
        path: exp._path,
        source: exp.source,
        output,
      })
    }

    // Parse rollup:commonjs:browser tasks
    for (const exp of exports) {
      const output = exp.browser?.require

      if (!output) continue

      addRollupTaskEntry('commonjs', 'browser', {
        path: exp._path,
        source: exp.browser?.source || exp.source,
        output,
      })
    }

    // Parse rollup:esm:browser tasks
    for (const exp of exports) {
      const output = exp.browser?.import

      if (!output) continue

      addRollupTaskEntry('esm', 'browser', {
        path: exp._path,
        source: exp.browser?.source || exp.source,
        output,
      })
    }

    for (const bundle of bundles) {
      const idx = bundles.indexOf(bundle)

      if (bundle.require) {
        addRollupTaskEntry('commonjs', bundle.runtime || ctx.runtime, {
          path: `__$$bundle_cjs_${idx}$$__`,
          source: bundle.source,
          output: bundle.require,
        })
      }

      if (bundle.import) {
        addRollupTaskEntry('esm', bundle.runtime || ctx.runtime, {
          path: `__$$bundle_esm_${idx}$$__`,
          source: bundle.source,
          output: bundle.import,
        })
      }
    }

    tasks.push(...Object.values(rollupTasks))

    // Write legacy exports files
    if (config?.legacyExports) {
      for (const exp of exports) {
        if (exp._exported && exp._path !== '.') {
          const relativeTargetPath = (exp.browser?.import || exp.import || '').replace(
            /\.[^/.]+$/,
            '',
          )

          if (relativeTargetPath) {
            fs.writeFileSync(
              path.resolve(cwd, `${exp._path}.js`),
              ['// AUTO-GENERATED – DO NOT EDIT', `export * from '${relativeTargetPath}'`, ''].join(
                '\n',
              ),
            )
          }
        }
      }
    }
  }

  return tasks
}
