import chalk from 'chalk'
import path from 'path'
import {rollup} from 'rollup'
import {Observable} from 'rxjs'

import {createConsoleSpy} from '../../consoleSpy'
import {BuildContext} from '../../core'
import {RollupTask, TaskHandler} from '../types'
import {resolveRollupConfig} from './resolveRollupConfig'

/** @internal */
export const rollupTask: TaskHandler<RollupTask> = {
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
    return new Observable((observer) => {
      execPromise(ctx, task)
        .then((result) => {
          observer.next(result)
          observer.complete()
        })
        .catch((err) => observer.error(err))
    })
  },
  complete: () => {
    //
  },
  error: (_ctx, _task, err) => {
    // eslint-disable-next-line no-console
    console.error(err)
  },
}

async function execPromise(ctx: BuildContext, task: RollupTask) {
  const {distPath, files, logger} = ctx
  const outDir = path.relative(ctx.cwd, distPath)

  // Prevent rollup from printing directly to the console
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

  try {
    const {inputOptions, outputOptions} = resolveRollupConfig(ctx, task)

    // Create bundle
    const bundle = await rollup({
      ...inputOptions,
      onwarn(warning) {
        if (
          // Ignore the directive warning until the preserveDirectives plugin does it automatically: https://github.com/Ephem/rollup-plugin-preserve-directives#rollup-plugin-preserve-directives-warning
          warning.message.includes(
            'Module level directives cause errors when bundled, "use client" in',
          )
        ) {
          // If the preserve option isn't enabled, then extend the message with a note about how to enable
          if (!ctx.config?.preserveModuleDirectives) {
            consoleSpy.messages.push({
              type: 'warn',
              code: warning.code,
              args: [
                `${warning.message} You can preserve it by setting "preserveModuleDirectives: true" in your "package.config.ts"`,
              ],
            })
          }

          return
        }

        consoleSpy.messages.push({
          type: 'warn',
          code: warning.code,
          args: [warning.message],
        })
      },
    })

    // generate output specific code in-memory
    // you can call this function multiple times on the same bundle object
    const {output} = await bundle.generate(outputOptions)

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
    await bundle.write(outputOptions)

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
