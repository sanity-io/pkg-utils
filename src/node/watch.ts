import path from 'path'
import {switchMap} from 'rxjs'
import {loadConfig, loadPkgWithReporting} from './core'
import {resolveBuildContext} from './resolveBuildContext'
import {resolveWatchTasks} from './resolveWatchTasks'
import {WatchTask, TaskHandler, watchTaskHandlers} from './tasks'
import {watchConfigFiles} from './watchConfigFiles'

/** @public */
export async function watch(options: {
  cwd: string
  strict?: boolean
  tsconfig?: string
}): Promise<void> {
  const {cwd, strict = false, tsconfig: tsconfigOption} = options

  const configFiles$ = await watchConfigFiles({cwd})

  const ctx$ = configFiles$.pipe(
    switchMap(async (configFiles) => {
      const files = configFiles.map((f) => path.relative(cwd, f))

      const packageJsonPath = files.find((f) => f === 'package.json')

      if (!packageJsonPath) {
        throw new Error('missing package.json')
      }

      const pkg = await loadPkgWithReporting({cwd})
      const config = await loadConfig({cwd})
      const tsconfig = tsconfigOption || config?.tsconfig || 'tsconfig.json'

      return resolveBuildContext({config, cwd, pkg, strict, tsconfig})
    })
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
