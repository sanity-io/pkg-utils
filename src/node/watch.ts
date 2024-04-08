import path from 'node:path'

import {switchMap} from 'rxjs'

import {loadConfig, loadPkgWithReporting} from './core'
import {createLogger} from './logger'
import {resolveBuildContext} from './resolveBuildContext'
import {resolveWatchTasks} from './resolveWatchTasks'
import {type TaskHandler, type WatchTask, watchTaskHandlers} from './tasks'
import {watchConfigFiles} from './watchConfigFiles'

/** @public */
export async function watch(options: {
  cwd: string
  strict?: boolean
  tsconfig?: string
}): Promise<void> {
  const {cwd, strict = false, tsconfig: tsconfigOption} = options

  const logger = createLogger()

  const configFiles$ = await watchConfigFiles({cwd, logger})

  const ctx$ = configFiles$.pipe(
    switchMap(async (configFiles) => {
      const files = configFiles.map((f) => path.relative(cwd, f))

      const packageJsonPath = files.find((f) => f === 'package.json')

      if (!packageJsonPath) {
        throw new Error('missing package.json')
      }

      const config = await loadConfig({cwd})
      const legacyExports = config?.legacyExports ?? false
      const pkg = await loadPkgWithReporting({cwd, logger, strict, legacyExports})
      const tsconfig = tsconfigOption || config?.tsconfig || 'tsconfig.json'

      return resolveBuildContext({config, cwd, logger, pkg, strict, tsconfig})
    }),
  )

  ctx$.subscribe(async (ctx) => {
    const watchTasks = resolveWatchTasks(ctx)

    for (const task of watchTasks) {
      const handler = watchTaskHandlers[task.type] as TaskHandler<WatchTask, unknown>
      const result$ = handler.exec(ctx, task)

      result$.subscribe({
        error: (err) => {
          ctx.logger.error(err)
          ctx.logger.log()

          process.exit(1)
        },
        next: (result) => {
          handler.complete(ctx, task, result)
        },
        complete: () => {
          ctx.logger.success(handler.name(ctx, task))
          ctx.logger.log()
        },
      })
    }
  })
}
