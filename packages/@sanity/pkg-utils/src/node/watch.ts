import path from 'node:path'
import {up as findPkgPath} from 'empathic/package'
import type {Subscription} from 'rxjs'
import {switchMap} from 'rxjs'
import {loadConfig} from './core/config/loadConfig.ts'
import {resolveVanillaExtract, resolveVanillaExtractCssName} from './core/config/vanillaExtract.ts'
import {loadPkgWithReporting} from './core/pkg/loadPkgWithReporting.ts'
import {writeBundleCssExports} from './core/pkg/writeBundleCssExports.ts'
import {createLogger} from './logger.ts'
import {resolveBuildContext} from './resolveBuildContext.ts'
import {resolveWatchTasks} from './resolveWatchTasks.ts'
import {watchTaskHandlers} from './tasks/index.ts'
import {type TaskHandler, type WatchTask} from './tasks/types.ts'

/** @public */
export async function watch(options: {
  cwd: string
  strict?: boolean
  tsconfig?: string
  signal?: AbortSignal
}): Promise<void> {
  const {cwd, strict = false, tsconfig: tsconfigOption, signal} = options

  const logger = createLogger()

  const {watchConfigFiles} = await import('./watchConfigFiles.ts')
  const configFiles$ = await watchConfigFiles({cwd, logger})

  const taskSubscriptions: Subscription[] = []

  const ctx$ = configFiles$.pipe(
    switchMap(async (configFiles) => {
      const files = configFiles.map((f) => path.relative(cwd, f))

      const packageJsonPath = files.find((f) => f === 'package.json')

      const pkgPath = findPkgPath({cwd})
      if (!packageJsonPath || !pkgPath) {
        throw new Error('missing package.json', {cause: {cwd}})
      }

      const config = await loadConfig({cwd, pkgPath})
      const {parseStrictOptions} = await import('./strict.ts')
      const strictOptions = parseStrictOptions(config?.strictOptions ?? {})
      const pkg = await loadPkgWithReporting({pkgPath, logger, strict, strictOptions})
      const tsconfig = tsconfigOption || config?.tsconfig || 'tsconfig.json'

      return resolveBuildContext({config, cwd, logger, pkg, strict, tsconfig})
    }),
  )

  const ctxSubscription = ctx$.subscribe(async (ctx) => {
    // Unsubscribe previous task subscriptions when config changes trigger a new context
    for (const sub of taskSubscriptions) {
      sub.unsubscribe()
    }
    taskSubscriptions.length = 0

    // Keep the conditional `./<css>` export in package.json in sync with the injected
    // `import "<pkg>/<css>"` for watch builds too (idempotent, so it won't loop).
    const vanillaExtract = resolveVanillaExtract(ctx.config)
    if (vanillaExtract.compatMode) {
      await writeBundleCssExports({
        cwd,
        distPath: ctx.distPath,
        cssName: resolveVanillaExtractCssName(vanillaExtract.options, {
          compatMode: true,
          runtime: '*',
        }),
        logger,
      })
    }

    const watchTasks = resolveWatchTasks(ctx)

    for (const task of watchTasks) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- TypeScript can't infer the correct handler type from discriminated union
      const handler = watchTaskHandlers[task.type] as TaskHandler<WatchTask, unknown>
      const result$ = handler.exec(ctx, task)

      const sub = result$.subscribe({
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

      taskSubscriptions.push(sub)
    }
  })

  if (signal) {
    signal.addEventListener(
      'abort',
      () => {
        for (const sub of taskSubscriptions) {
          sub.unsubscribe()
        }
        taskSubscriptions.length = 0
        ctxSubscription.unsubscribe()
      },
      {once: true},
    )
  }
}
