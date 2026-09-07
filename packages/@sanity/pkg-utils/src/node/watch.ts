import {up as findPkgPath} from 'empathic/package'
import type {Subscription} from 'rxjs'
import {switchMap} from 'rxjs'
import {build as tsdownBuild, type TsdownHandle} from 'tsdown'
import {loadConfig} from './core/config/loadConfig.ts'
import {usesCssExportNodeCompat} from './core/pkg/cssExportOptions.ts'
import {loadPkgWithReporting} from './core/pkg/loadPkgWithReporting.ts'
import {writeBundleCssExports} from './core/pkg/writeBundleCssExports.ts'
import {createLogger} from './logger.ts'
import {resolveBuildContext} from './resolveBuildContext.ts'
import {resolveTsdownBuilds} from './tasks/tsdown/resolveTsdownBuilds.ts'
import {resolveTsdownConfig} from './tasks/tsdown/resolveTsdownConfig.ts'

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

  // RxJS does not await async subscriber callbacks. Only the latest runId may
  // publish handles; a stale or aborted run must close the handles it created.
  let handles: TsdownHandle[] = []
  let runId = 0
  const closeHandles = async () => {
    const closing = handles
    handles = []
    for (const handle of closing) {
      await handle.watch.close()
    }
  }

  const ctx$ = configFiles$.pipe(
    switchMap(async () => {
      const pkgPath = findPkgPath({cwd})
      if (!pkgPath) {
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

  const ctxSubscription: Subscription = ctx$.subscribe(async (ctx) => {
    const id = ++runId
    const runHandles: TsdownHandle[] = []
    try {
      await closeHandles()

      const cssNames: string[] = []
      const cssSources: Record<string, string> = {}

      const vanillaExtract = ctx.config?.vanillaExtract
      if (vanillaExtract) {
        const veOptions = vanillaExtract === true ? {} : vanillaExtract
        if (usesCssExportNodeCompat(veOptions)) {
          cssNames.push(veOptions.fileName || 'bundle.css')
        }
      }

      // The `@tsdown/css` pipeline's own exports: the `.css` export subpaths built by the
      // stylesheet build. Their file names follow their subpath and a declared entry always
      // emits, so they are known up front. The merged `style.css` of CSS imported from JS is
      // not — it only exists once something actually imports CSS — so `resolveTsdownConfig`
      // declares that one from a `build:done` hook instead, matching what
      // `cssNodeCompatPlugin` declares in a full build.
      const cssConfig = ctx.config?.css
      const cssNodeCompat =
        (Boolean(cssConfig) || ctx.cssExports.length > 0) &&
        usesCssExportNodeCompat(cssConfig ?? {})
      if (cssNodeCompat) {
        for (const cssExport of ctx.cssExports) {
          cssNames.push(cssExport._path.replace(/^\.\//, ''))
          cssSources[cssExport._path] = cssExport.source
        }
      }

      await writeBundleCssExports({
        cwd,
        distPath: ctx.distPath,
        cssNames,
        sources: cssSources,
        logger,
      })

      const builds = resolveTsdownBuilds(ctx)

      let first = true
      for (const buildDef of builds) {
        if (id !== runId) break

        const inlineConfig = await resolveTsdownConfig(ctx, buildDef, {
          clean: first,
          watch: true,
        })
        first = false

        runHandles.push(await tsdownBuild(inlineConfig))
      }

      if (id !== runId) {
        for (const handle of runHandles) {
          await handle.watch.close()
        }
        return
      }

      handles = runHandles

      logger.success(`${ctx.pkg.name}: watching for file changes\u2026`)
      logger.log()
    } catch (err) {
      ctx.logger.error(err)
      ctx.logger.log()

      process.exit(1)
    }
  })

  if (signal) {
    signal.addEventListener(
      'abort',
      () => {
        runId++
        ctxSubscription.unsubscribe()
        void closeHandles()
      },
      {once: true},
    )
  }
}
