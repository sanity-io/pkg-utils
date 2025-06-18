import path from 'node:path'
import chalk from 'chalk'
import {rolldown} from 'rolldown'
import {from} from 'rxjs'
import {createConsoleSpy} from '../../consoleSpy'
import type {BuildContext} from '../../core/contexts/buildContext'
import {resolveRollupConfig} from '../rollup/resolveRollupConfig'
import type {RolldownDtsTask, TaskHandler} from '../types'

/** @internal */
export const rolldownDtsTask: TaskHandler<RolldownDtsTask> = {
  name: (ctx, task) => {
    const bundleEntries = task.entries.filter((e) => e.path.includes('__$$bundle_'))
    const entries = task.entries.filter((e) => !e.path.includes('__$$bundle_'))

    const targetLines = task.target.length
      ? [`  target:`, ...task.target.map((t) => `    - ${chalk.yellow(t)}`)]
      : []

    const bundlesLines = bundleEntries.length
      ? [
          '  bundles:',
          ...bundleEntries.map((e) =>
            [
              `    - `,
              `${chalk.yellow(e.source)} ${chalk.gray('→')} ${chalk.yellow(e.output)}`,
            ].join(''),
          ),
        ]
      : []

    const entriesLines = entries.length
      ? [
          '  entries:',
          ...entries.map((e) =>
            [
              `    - `,
              `${chalk.cyan(path.join(ctx.pkg.name, e.path))}: `,
              `${chalk.yellow(e.source)} ${chalk.gray('→')} ${chalk.yellow(e.output)}`,
            ].join(''),
          ),
        ]
      : []

    return [
      `Build javascript files...`,
      `  format: ${chalk.yellow(task.format)}`,
      ...targetLines,
      ...bundlesLines,
      ...entriesLines,
    ].join('\n')
  },
  exec: (ctx, task) => {
    return from(execPromise(ctx, task))
    // return new Observable((observer) => {
    //   execPromise(ctx, task)
    //     .then((result) => {
    //       observer.next(result)
    //       observer.complete()
    //     })
    //     .catch((err) => observer.error(err))
    // })
  },
  complete: () => {
    //
  },
  error: (_ctx, _task, err) => {
    console.error(err)
  },
}

async function execPromise(ctx: BuildContext, task: RolldownDtsTask) {
  const {distPath, files, logger} = ctx
  const outDir = path.relative(ctx.cwd, distPath)

  // Prevent rolldown from printing directly to the console
  const consoleSpy = createConsoleSpy({
    onRestored: (messages) => {
      for (const msg of messages) {
        const text = String(msg.args[0])

        if (msg.code === 'CIRCULAR_DEPENDENCY') {
          continue // ignore
        }

        if (text.startsWith('Dynamic import can only')) {
          continue // ignore
        }

        if (text.startsWith('Sourcemap is likely to be incorrect')) {
          continue // ignore
        }

        if (msg.type === 'log') {
          logger.info(...msg.args)
        }

        if (msg.type === 'warn') {
          logger.warn(...msg.args)
        }

        if (msg.type === 'error') {
          logger.error(...msg.args)
        }
      }
    },
  })

  const {dts: dtsPlugin} = await import('rolldown-plugin-dts')

  try {
    const {inputOptions: _inputOptions, outputOptions} = resolveRollupConfig(ctx, task)
    const {treeshake: _treeshake, plugins: _plugins, ...inputOptions} = _inputOptions

    // Create bundle
    // @ts-expect-error - TODO: fix this
    const bundle = await rolldown({
      ...inputOptions,
      plugins: [dtsPlugin({emitDtsOnly: true, tsconfig: ctx.ts.configPath || 'tsconfig.json'})],
      onwarn(warning) {
        consoleSpy.messages.push({
          type: 'warn',
          code: warning.code,
          args: [warning.message],
        })
      },
    })

    // generate output specific code in-memory
    // you can call this function multiple times on the same bundle object
    const {output} = await bundle.generate(
      // @ts-expect-error - TODO: fix this
      outputOptions,
    )

    for (const chunkOrAsset of output) {
      if (chunkOrAsset.type === 'asset') {
        files.push({
          type: 'asset',
          path: path.resolve(outDir, chunkOrAsset.fileName),
        })
      } else {
        files.push({
          type: 'chunk',
          path: path.resolve(outDir, chunkOrAsset.fileName),
        })
      }
    }

    // or write the bundle to disk
    await bundle.write(
      // @ts-expect-error - TODO: fix this
      outputOptions,
    )

    // closes the bundle
    await bundle.close()

    // Restore console
    consoleSpy.restore()
  } catch (err) {
    // Restore console
    consoleSpy.restore()
    throw err
  }
}
