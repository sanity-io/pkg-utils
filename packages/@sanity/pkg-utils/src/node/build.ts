import {existsSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import path from 'node:path'
import {up as findPkgPath} from 'empathic/package'
import {build as tsdownBuild, type TsdownBundle} from 'tsdown'
import {loadConfig} from './core/config/loadConfig.ts'
import {isRecord} from './core/isRecord.ts'
import {loadPkgWithReporting} from './core/pkg/loadPkgWithReporting.ts'
import {createLogger, type Logger} from './logger.ts'
import {resolveBuildContext} from './resolveBuildContext.ts'
import {createSpinner} from './spinner.ts'
import {
  resolveTsdownBuilds,
  type TsdownBuild as TsdownBuildDef,
} from './tasks/tsdown/resolveTsdownBuilds.ts'
import {resolveTsdownConfig} from './tasks/tsdown/resolveTsdownConfig.ts'

const RE_TS_SOURCE = /\.[cm]?tsx?$/

/**
 * Build the distribution files of a npm package.
 *
 * @example
 * ```ts
 * import {build} from '@sanity/pkg-utils'
 *
 * build({
 *   cwd: process.cwd(),
 *   tsconfig: 'tsconfig.dist.json,
 * }).then(() => {
 *   console.log('successfully built')
 * }).catch((err) => {
 *   console.log(`build error: ${err.message}`)
 * })
 * ```
 *
 * @public
 */
export async function build(options: {
  cwd: string
  emitDeclarationOnly?: boolean
  strict?: boolean
  tsconfig?: string
  clean?: boolean
  quiet?: boolean
}): Promise<void> {
  const {
    cwd,
    emitDeclarationOnly,
    strict = false,
    tsconfig: tsconfigOption,
    // `--no-clean` skips cleaning for this run; `true` (the CLI default — `--clean` still
    // parses as a no-op for v11 compatibility) defers to the `clean` config option
    clean = true,
    quiet = false,
  } = options
  const logger = createLogger(quiet)

  const pkgPath = findPkgPath({cwd})
  if (!pkgPath) {
    throw new Error('no package.json found', {cause: {cwd}})
  }
  const config = await loadConfig({cwd, pkgPath})

  const {parseStrictOptions} = await import('./strict.ts')
  const strictOptions = parseStrictOptions(config?.strictOptions ?? {})
  const pkg = await loadPkgWithReporting({pkgPath, logger, strict, strictOptions})

  const tsconfig = tsconfigOption || config?.tsconfig || 'tsconfig.json'

  const ctx = await resolveBuildContext({
    config,
    cwd,
    emitDeclarationOnly,
    logger,
    pkg,
    strict,
    tsconfig,
  })

  warnAboutTsdownConfigFiles(cwd, logger)

  const builds = resolveTsdownBuilds(ctx)

  let first = true
  for (const buildDef of builds) {
    // A types-only run skips builds without TypeScript sources entirely
    if (
      ctx.emitDeclarationOnly &&
      !buildDef.entries.some((entry) => RE_TS_SOURCE.test(entry.source))
    ) {
      continue
    }

    const taskName = buildTaskName(buildDef)
    const spinner = createSpinner(taskName, quiet)

    try {
      const inlineConfig = await resolveTsdownConfig(ctx, buildDef, {clean: first && clean})
      first = false

      const bundles = await tsdownBuild(inlineConfig)

      if (ctx.emitDeclarationOnly) {
        // `dts.emitDtsOnly` suppresses the JS chunks of the ES pass, but the CJS pass emits
        // its JS regardless (only its extra dts pass runs the dts plugin) — a types-only
        // build removes everything that is not a declaration file
        removeNonDeclarationOutputs(bundles)
      }

      if (buildDef.canonical) {
        restoreAuthoredTypes(ctx)
      }

      spinner.complete()
      ctx.logger.log()

      printBuildOutputs(ctx, bundles, buildDef)
      ctx.logger.log()
    } catch (err) {
      spinner.error()

      if (err instanceof Error) {
        const RE_CWD = new RegExp(escapeRegExp(cwd), 'g')

        ctx.logger.error((err.stack || err.message).replace(RE_CWD, '.'))
        ctx.logger.log()
      }

      process.exit(1)
    }
  }
}

function buildTaskName(buildDef: TsdownBuildDef): string {
  const formats = Array.from(new Set(buildDef.entries.flatMap((entry) => entry.formats)))
  return `build ${buildDef.key} (${formats.join(', ') || 'types'})`
}

const RE_DTS_OUTPUT = /\.d\.[mc]?ts(\.map)?$/

/** Removes every emitted file that is not a declaration file (or its sourcemap). */
function removeNonDeclarationOutputs(bundles: TsdownBundle[]): void {
  for (const bundle of bundles) {
    for (const chunk of bundle.chunks) {
      if (RE_DTS_OUTPUT.test(chunk.fileName)) continue
      rmSync(path.join(chunk.outDir, chunk.fileName), {force: true})
      rmSync(path.join(chunk.outDir, `${chunk.fileName}.map`), {force: true})
    }
  }
}

/**
 * Prints `<pkg>: <source> → <output>` for every entry chunk (JS and `.d.ts`) that tsdown
 * emitted, mirroring the per-file output of previous majors.
 */
function printBuildOutputs(
  ctx: {cwd: string; distPath: string; emitDeclarationOnly: boolean; logger: Logger; pkg: {name: string}},
  bundles: TsdownBundle[],
  buildDef: TsdownBuildDef,
): void {
  const {cwd, logger, pkg} = ctx
  const lines = new Set<string>()

  // Stylesheets are emitted as assets, which carry no `facadeModuleId` back to their source,
  // so the stylesheet build's lines come from its entry map instead.
  if (buildDef.css) {
    for (const entry of buildDef.entries) {
      const output = `./${path
        .relative(cwd, path.join(ctx.distPath, `${entry.alias}.css`))
        .replaceAll('\\', '/')}`
      lines.add(`${pkg.name}: ./${path.relative(cwd, path.resolve(cwd, entry.source)).replaceAll('\\', '/')} \u2192 ${output}`)
    }
  }

  for (const bundle of bundles) {
    for (const chunk of bundle.chunks) {
      if (chunk.type !== 'chunk' || !chunk.isEntry || !chunk.facadeModuleId) continue
      if (ctx.emitDeclarationOnly && !RE_DTS_OUTPUT.test(chunk.fileName)) continue
      const source = `./${path
        .relative(cwd, chunk.facadeModuleId)
        .replaceAll('\\', '/')
        // the dts chunks facade the fake `.d.ts` module ids of rolldown-plugin-dts; print the
        // actual `.ts` source instead
        .replace(/\.d\.([mc]?)ts$/, '.$1ts')}`
      const output = `./${path
        .relative(cwd, path.join(chunk.outDir, chunk.fileName))
        .replaceAll('\\', '/')}`
      lines.add(`${pkg.name}: ${source} \u2192 ${output}`)
    }
  }

  for (const line of Array.from(lines).toSorted()) {
    logger.log(line)
  }
}

/**
 * tsdown's exports generation rewrites the top-level `types` field alongside `main`/`module`
 * when the `legacy` fields are maintained, preferring the CJS declarations (`.d.cts`) for
 * dual-format packages. The hand-written value is authoritative here (the Sanity convention
 * points `types` at the ESM `.d.ts`), so it is restored after the canonical build.
 */
function restoreAuthoredTypes(ctx: {cwd: string; pkg: {types?: string | undefined}}): void {
  const authoredTypes = ctx.pkg.types
  if (!authoredTypes) return

  const pkgPath = path.resolve(ctx.cwd, 'package.json')
  let text: string
  try {
    text = readFileSync(pkgPath, 'utf8')
  } catch {
    return
  }
  const json: unknown = JSON.parse(text)
  if (!isRecord(json) || json['types'] === authoredTypes) return
  json['types'] = authoredTypes

  const indent = /^([ \t]+)\S/m.exec(text)?.[1] ?? 2
  let output = JSON.stringify(json, null, indent)
  if (text.endsWith('\n')) output += '\n'
  writeFileSync(pkgPath, output, 'utf8')
}

/**
 * pkg-utils owns its own experience: `tsdown.config.*` files are never loaded in pkg-utils
 * mode (`package.config.ts` is the sole config source), so their presence is worth a warning.
 */
function warnAboutTsdownConfigFiles(cwd: string, logger: Logger): void {
  const candidates = [
    'tsdown.config.ts',
    'tsdown.config.mts',
    'tsdown.config.cts',
    'tsdown.config.js',
    'tsdown.config.mjs',
    'tsdown.config.cjs',
    'tsdown.config.json',
  ]
  const found = candidates.find((candidate) => existsSync(path.resolve(cwd, candidate)))
  if (found) {
    logger.warn(
      `found \`${found}\`, which @sanity/pkg-utils does not load — \`package.config.ts\` is the only config source of \`pkg build\`. Either migrate the package fully to tsdown (and drop @sanity/pkg-utils), or move the configuration into \`package.config.ts\`.`,
    )
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
