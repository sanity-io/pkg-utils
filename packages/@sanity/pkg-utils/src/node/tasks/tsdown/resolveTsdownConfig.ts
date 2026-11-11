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

function hasNativePreview(pkg: {devDependencies?: unknown}): boolean {
  return (
    typeof pkg.devDependencies === 'object' &&
    pkg.devDependencies !== null &&
    '@typescript/native-preview' in pkg.devDependencies
  )
}

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

  const hasTsSources =
    !build.css && build.entries.some((buildEntry) => RE_TS_SOURCE.test(buildEntry.source))
  const dtsObject = typeof config?.dts === 'object' ? config.dts : undefined
  // Strip a leftover top-level `newContext` after migrating it under `tsc` — rolldown-plugin-dts
  // 0.29+ throws when the same option is set at both levels with conflicting values.
  const {newContext: dtsNewContext, tsc: dtsTsc, entry: dtsEntry, ...restDtsObject} = dtsObject ?? {}
  const nativePreviewGenerator = hasNativePreview(pkg) ? ({generator: 'tsgo'} as const) : undefined
  // rolldown-plugin-dts 0.30 rejects `entry` together with `dtsOnly`. tsdown already drops
  // the filter for its CJS declaration pass and applies it to Rolldown's input; a
  // declaration-only ESM build has to do that itself or the plugin throws before emitting.
  const rolldownEntry =
    ctx.emitDeclarationOnly && dtsEntry !== undefined
      ? filterDeclarationEntries(entry, dtsEntry, restDtsObject.cwd ?? cwd, cwd)
      : entry
  const dts =
    hasTsSources && config?.dts !== false
      ? {
          ...nativePreviewGenerator,
          ...restDtsObject,
          ...(dtsEntry !== undefined && !ctx.emitDeclarationOnly ? {entry: dtsEntry} : {}),
          tsc: {newContext: dtsNewContext ?? true, ...dtsTsc},
          ...(ctx.emitDeclarationOnly ? {dtsOnly: true} : {}),
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

  // `reactCompiler`'s type still includes `reactServer?: boolean`, so this overload can
  // resolve to one config or two. `reactServer: true` already threw above.
  const baseOrBuilds = await defineConfig({
    cwd,
    tsconfig: ctx.ts.configPath,
    platform,
    format,
    entry: rolldownEntry,
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
  if (Array.isArray(baseOrBuilds)) {
    throw new Error(
      [
        'package.config.ts: `reactCompiler.reactServer` is not supported by `pkg build` — the',
        'dual React Server Components build needs one tsdown run driving multiple configs.',
        'Use `tsdown` + `@sanity/tsdown-config` directly instead: export the config from',
        '`tsdown.config.ts` and build with `tsdown`.',
      ].join('\n'),
    )
  }
  const base = baseOrBuilds

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
    ...(options.watch
      ? {
          watch: true,
          // tsdown restarts itself on these paths and discards the handle pkg-utils
          // holds. pkg watch reloads the waterfall instead.
          ignoreWatch: [path.join(cwd, 'package.json'), ctx.ts.configPath ?? 'tsconfig.json'],
        }
      : {}),
  }
}

/**
 * tsdown 0.23 treats an empty entry object as "unspecified" and falls back to `src/index.ts`.
 * A declaration-only filter that excludes every input of a build must skip that build instead.
 * @internal
 */
export function isEmptyRolldownEntry(entry: InlineConfig['entry']): boolean {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    !Array.isArray(entry) &&
    Object.keys(entry).length === 0
  )
}

/**
 * `path.relative` yields `src/index.ts`, while `exports.source` and tsdown entry globs often
 * keep a `./` prefix. `path.matchesGlob` treats that prefix as literal, so strip it from both
 * sides before comparing.
 */
function normalizeDeclarationGlob(value: string): string {
  const normalized = value.replaceAll('\\', '/')
  return normalized.startsWith('./') ? normalized.slice(2) : normalized
}

/**
 * Applies `dts.entry` to Rolldown's input for a declaration-only build, the same way tsdown
 * filters the CJS declaration pass. `!` patterns are exclusions. Paths are matched relative
 * to `dts.cwd`, falling back to the package directory.
 * @internal
 */
function filterDeclarationEntries(
  entry: Record<string, string>,
  patterns: string | readonly string[],
  dtsCwd: string,
  cwd: string,
): Record<string, string> {
  const includes: string[] = []
  const ignores: string[] = []
  for (const pattern of typeof patterns === 'string' ? [patterns] : patterns) {
    if (pattern.startsWith('!')) ignores.push(normalizeDeclarationGlob(pattern.slice(1)))
    else includes.push(normalizeDeclarationGlob(pattern))
  }
  return Object.fromEntries(
    Object.entries(entry).filter(([, file]) => {
      const id = normalizeDeclarationGlob(path.relative(dtsCwd, path.resolve(cwd, file)))
      return (
        includes.some((pattern) => path.matchesGlob(id, pattern)) &&
        ignores.every((pattern) => !path.matchesGlob(id, pattern))
      )
    }),
  )
}

/** @internal */
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
