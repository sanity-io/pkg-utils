import path from 'node:path'
import {
  defineConfig,
  type ReactCompilerOptions as TsdownConfigReactCompilerOptions,
} from '@sanity/tsdown-config'
import {mergeConfig, type InlineConfig, type UserConfig} from 'tsdown'
import type {PkgConfigOptions} from '../../core/config/types.ts'
import type {BuildContext} from '../../core/contexts/buildContext.ts'
import {pkgExtMap} from '../../core/pkg/pkgExt.ts'
import {createExportsComposer} from './composeExports.ts'
import type {TsdownBuild} from './resolveTsdownBuilds.ts'

const RE_TS_SOURCE = /\.[cm]?tsx?$/

/**
 * Composes the tsdown config for one build of the waterfall: `@sanity/tsdown-config`'s
 * `defineConfig()` provides the shared Sanity base, and the pkg-utils opinions (browserslist
 * targets, `PKG_*` defines, exports reconciliation, dts selection) layer over it with
 * tsdown's `mergeConfig`.
 *
 * pkg-utils owns its own experience: the returned config carries `config: false`, so tsdown
 * never loads `tsdown.config.*` files — `package.config.ts` is the sole config source — and
 * `logLevel: 'warn'` keeps tsdown's info chatter out of pkg-utils' own output.
 * @internal
 */
export async function resolveTsdownConfig(
  ctx: BuildContext,
  build: TsdownBuild,
  options: {
    /**
     * Whether this build may clean: only the first build of the waterfall cleans (so later
     * builds can't wipe earlier output), and `--no-clean` turns it off for the whole run.
     */
    clean: boolean
    watch?: boolean
  },
): Promise<InlineConfig> {
  const {config, cwd, distPath, pkg} = ctx

  // `?? false` up front (like tsdown-config's own normalization): JS configs bypass the
  // types, and a `reactCompiler: null` would pass the `typeof … === 'object'` checks below
  const reactCompiler = config?.reactCompiler ?? false
  if (typeof reactCompiler === 'object' && reactCompiler.reactServer === true) {
    throw new Error(
      [
        'package.config.ts: `reactCompiler.reactServer` is not supported by `pkg build` — the',
        'dual React Server Components build needs one tsdown run driving multiple configs.',
        'Use `tsdown` + `@sanity/tsdown-config` directly instead: export the config from',
        '`tsdown.config.ts` and build with `tsdown`.',
      ].join('\n'),
    )
  }
  // Pin the `'babel'` default before forwarding: `@sanity/tsdown-config` defaults to `'oxc'`
  // since 0.27, and inheriting the flip would break published configs.
  const reactCompilerOption: TsdownConfigReactCompilerOptions | boolean =
    typeof reactCompiler === 'object'
      ? reactCompiler.transform === 'oxc'
        ? reactCompiler
        : {...reactCompiler, transform: 'babel'}
      : reactCompiler
        ? {transform: 'babel'}
        : false

  const entry: Record<string, string> = {}
  for (const buildEntry of build.entries) {
    entry[buildEntry.alias] = buildEntry.source
  }

  // tsdown's `format` applies to the whole build (and its exports generation composes the
  // dual `import`/`require` map from both formats' chunks of one build), so the entries'
  // formats union: every entry is emitted in every format of the build. Mixed per-entry
  // coverage gets a heads-up — the extra files are emitted, and local exports generation
  // will declare them.
  const formats = new Set(build.entries.flatMap((buildEntry) => buildEntry.formats))
  if (formats.size > 1) {
    const partial = build.entries.filter((buildEntry) => buildEntry.formats.length < formats.size)
    if (partial.length) {
      const names = partial
        .map((buildEntry) =>
          buildEntry.exportPath ? `exports["${buildEntry.exportPath}"]` : buildEntry.source,
        )
        .join(', ')
      ctx.logger.warn(
        `${names} declare${partial.length === 1 ? 's' : ''} fewer formats than the rest of the package. tsdown emits every format of a build for every entry, so the missing format is built anyway (and local exports generation will declare it). Declare both \`import\` and \`require\` targets for every subpath — or for none — to keep the exports map unambiguous.`,
      )
    }
  }
  const format = [
    ...(formats.has('esm') ? ['esm' as const] : []),
    ...(formats.has('commonjs') ? ['cjs' as const] : []),
  ]

  const platform =
    build.runtime === 'node' ? 'node' : build.runtime === 'browser' ? 'browser' : 'neutral'

  // The `@tsdown/css` pipeline turns on when it's configured, and automatically for a package
  // that declares a `.css` export subpath with a `source`. The stylesheet build needs
  // `splitting` so each entry emits its own file at the path its subpath promises; the JS
  // builds keep `@tsdown/css`'s merged default, so CSS imported from JS lands in a single
  // `style.css` with one export and one injected import - the `bundle.css` shape of
  // `vanillaExtract`.
  const css: PkgConfigOptions['css'] | undefined =
    config?.css || ctx.cssExports.length
      ? {...config?.css, ...(build.css ? {splitting: true} : {})}
      : undefined

  // Build-time constants: `PKG_VERSION` reads the environment override first, like v11.
  // pkg-utils' own build skips it so the replacement logic in this very file survives its own
  // bundling. (`PKG_FORMAT`, `PKG_RUNTIME` and `PKG_FILE_PATH` were removed in v12 — see
  // MIGRATE.md for the `package.json#imports` / `import.meta.url` replacements.)
  const define: Record<string, string> = {}
  if (pkg.name !== '@sanity/pkg-utils') {
    define['process.env.PKG_VERSION'] = JSON.stringify(process.env['PKG_VERSION'] || pkg.version)
  }
  for (const [key, value] of Object.entries(config?.define || {})) {
    define[key] = JSON.stringify(value)
  }

  // Types are generated with tsdown (rolldown-plugin-dts). `@typescript/native-preview` in
  // devDependencies auto-enables tsgo, like v11; an explicit `dts.tsgo` wins. Only the object
  // form spreads: when the `legacyChecks` migration errors are skipped
  // (`NODE_ENV=production` / `legacyChecks: false`), a leftover v11 string like
  // `dts: 'rolldown'` must degrade to the default behavior (which is what it meant) instead
  // of spreading into numeric character keys.
  const hasTsSources =
    !build.css && build.entries.some((buildEntry) => RE_TS_SOURCE.test(buildEntry.source))
  const dtsPassthrough = typeof config?.dts === 'object' ? config.dts : undefined
  const dts =
    hasTsSources && config?.dts !== false
      ? {
          ...(typeof pkg.devDependencies === 'object' &&
          '@typescript/native-preview' in pkg.devDependencies
            ? {tsgo: true}
            : {}),
          // Always create dts from scratch, don't reuse contexts from previous builds
          newContext: true,
          ...dtsPassthrough,
          ...(ctx.emitDeclarationOnly ? {emitDtsOnly: true} : {}),
        }
      : false

  // Exports generation runs on the canonical build only, with `devExports: 'source'` — the
  // hand-written Sanity convention (`source` conditions in `exports`, a `source`-less
  // `publishConfig.exports`) — and the pkg-utils composer reconciling the generated map with
  // the hand-written one. `@sanity/tsdown-config`'s always-on exports default applies: the map
  // is rewritten on every build (CI included), so environments that set `CI=true` without
  // meaning "skip package.json" (Cursor Cloud, …) still keep exports in sync. A types-only
  // build never rewrites `package.json`, and neither do watch builds (a rewrite would
  // re-trigger the `package.json` watcher).
  const exports: UserConfig['exports'] =
    build.canonical && !ctx.emitDeclarationOnly && !options.watch && !build.css
      ? {
          devExports: 'source',
          customExports: createExportsComposer(ctx, build),
          // Keep the hand-written legacy fields (`main`/`module`) in sync instead of deleting
          // them; packages without them don't gain them
          ...(pkg.main || pkg.module ? {legacy: true} : {}),
        }
      : false

  // `@sanity/tsdown-config` defaults `tsdoc` to `false`; pkg-utils keeps the historical
  // default of enabled (`true`), and forwards an options object (with `bundledPackages` for
  // API Extractor's type resolution of inlined deps) when the user customized rules/tags.
  const tsdocOption =
    config?.tsdoc === false
      ? false
      : {
          ...(typeof config?.tsdoc === 'object' ? config.tsdoc : {}),
          bundledPackages: ctx.bundledPackages,
        }

  const base = await defineConfig({
    cwd,
    tsconfig: ctx.ts.configPath,
    platform,
    format,
    entry,
    // POSIX separators: on Windows `path.relative` yields backslashes, which would leak into
    // generated `package.json` export targets (e.g. the conditional vanilla-extract export)
    outDir: path.relative(cwd, distPath).replaceAll('\\', '/') || '.',
    target: ctx.target[build.runtime],
    define,
    sourcemap: config?.sourcemap,
    // tsdown owns cleaning: the first build of the waterfall carries the effective `clean`
    // (the config passthrough, or tsdown's default `true`), every later build gets `false`.
    // A types-only build never cleans, so it can't delete JS output.
    clean: options.clean && !ctx.emitDeclarationOnly ? config?.clean : false,
    dts,
    deps: ctx.deps,
    exports,
    css,
    reactCompiler: reactCompilerOption,
    styledComponents: config?.styledComponents,
    vanillaExtract: config?.vanillaExtract,
    bundleAnalyzer: config?.bundleAnalyzer,
    // Types-only builds still emit `.d.ts` files that deserve the check; watch mode skips it
    // so a failing TSDoc rule doesn't tear down the watcher on every save.
    tsdoc: options.watch ? false : tsdocOption,
  })

  // The hand-written exports define the emitted extensions (`.js`/`.mjs`/`.cjs` per
  // `package.json#type`, enforced by `validateExports`), so the extensions are pinned
  // explicitly instead of relying on tsdown's defaults (whose `fixedExtension` kicks in for
  // `platform: 'node'` and would emit `.mjs` for `type: module` packages).
  const extMap = pkgExtMap[pkg.type === 'module' ? 'module' : 'commonjs']
  const outExtensions: UserConfig['outExtensions'] = ({format: outputFormat}) => ({
    js: outputFormat === 'cjs' ? extMap.commonjs : extMap.esm,
  })

  const merged = mergeConfig(base, {
    outExtensions,
    // publint runs during `pkg check` (via its node API), not inside the build
    publint: false,
    // the per-file size report logs through tsdown's info channel; pkg-utils prints its own
    report: false,
    ...(config?.minify === true ? {minify: true} : {}),
    ...(config?.plugins === undefined ? {} : {plugins: config.plugins}),
    ...(options.watch && css ? {hooks: createWatchCssExportsHook(ctx, css)} : {}),
  })

  return {
    ...merged,
    config: false,
    logLevel: 'warn',
    ...(options.watch ? {watch: true} : {}),
  }
}

/**
 * Declares the conditional export of every CSS file a watch rebuild emitted.
 *
 * A full build leaves this to `cssNodeCompatPlugin`, which composes into tsdown's
 * `exports.customExports`. Watch mode turns tsdown's `exports` feature off (a `package.json`
 * write per rebuild would loop the watcher), so `pkg watch` maintains the exports itself. Most
 * of them are known before the build and are written once per context in `watch.ts`, but the
 * merged `style.css` of CSS imported from JS only exists when something actually imports CSS —
 * declaring it from the config alone would point the export at files nobody produced.
 *
 * `build:done` is the only place that knows: in watch mode `build()` resolves before the first
 * rebuild runs, so the returned bundle's chunks are still empty. The write is idempotent, so
 * the `package.json` watcher settles after one extra rebuild rather than looping.
 * @internal
 */
function createWatchCssExportsHook(
  ctx: BuildContext,
  css: NonNullable<PkgConfigOptions['css']>,
): NonNullable<UserConfig['hooks']> {
  // Only the merged mode has a CSS file name to declare up front. With `splitting` the names
  // follow the chunk names and the export is the host's to wire up, so a full build declares
  // nothing either.
  const mergedCssName = css.splitting ? undefined : css.fileName || 'style.css'

  return (hooks) => {
    hooks.hook('build:done', async ({chunks}) => {
      if (mergedCssName === undefined) return
      const emitted = chunks.some(
        (chunk) => chunk.type === 'asset' && chunk.fileName === mergedCssName,
      )
      if (!emitted) return

      const {writeBundleCssExports} = await import('../../core/pkg/writeBundleCssExports.ts')
      await writeBundleCssExports({
        cwd: ctx.cwd,
        distPath: ctx.distPath,
        cssNames: [mergedCssName],
        logger: ctx.logger,
      })
    })
  }
}
