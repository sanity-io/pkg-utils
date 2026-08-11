import path from 'node:path'
import type {PkgExport} from '../../core/config/types.ts'
import type {BuildContext} from '../../core/contexts/buildContext.ts'
import {isRecord} from '../../core/isRecord.ts'
import {createConditionalCssExport} from '../../core/pkg/cssExport.ts'
import type {TsdownBuild} from './resolveTsdownBuilds.ts'

type ExportsMap = Record<string, unknown>
interface ComposeContext {
  isPublish: boolean
}

/**
 * The pkg-utils opinion layer over tsdown's generated `exports` map, composed into
 * `exports.customExports` of the canonical build (the same composition hook
 * `@sanity/vanilla-extract-tsdown-plugin` uses for its conditional CSS export).
 *
 * tsdown generates subpaths from the entry aliases with `source`/`import`/`require` conditions
 * (`devExports: 'source'`) and a `source`-less `publishConfig.exports` — already the Sanity
 * convention. This composer reconciles the generated map with the hand-written one, which
 * remains the input:
 *
 * - generated keys are remapped to the hand-written subpaths (entry aliases are derived from
 *   the output paths, which don't have to match the subpath names),
 * - the hand-written `types`, `browser`, `node`, `development` and `monorepo` conditions are
 *   re-inserted (tsdown's generator cannot express them; the `browser`/`node` files are built
 *   by the variant builds of the waterfall) — with `source`-like conditions stripped from the
 *   publish variant,
 * - all hand-written conditions (`react-server`, `worker`, … included) retain their authored
 *   order in each map independently, because earlier matching conditions take precedence,
 * - generated conditions for conditional entries are materialized in both `exports` and
 *   `publishConfig.exports`, so they can be reordered directly in `package.json` and keep that
 *   position on later builds (plain-string entries stay compact),
 * - a trailing `default` condition is kept on dual-format entries and nested runtime variants
 *   (tsdown emits bare `import`/`require` pairs; the Sanity convention always ends with
 *   `default`),
 * - hand-written subpaths that aren't build entries (`.css`/`.json` exports, `svelte`
 *   entries) are carried over untouched, and
 * - the hand-written subpath and condition key order of each map is preserved.
 * @internal
 */
export function createExportsComposer(
  ctx: BuildContext,
  build: TsdownBuild,
): (exportsMap: ExportsMap, context: ComposeContext) => ExportsMap {
  const {pkg} = ctx
  const type = pkg.type === 'module' ? 'module' : 'commonjs'

  // POSIX separators: on Windows `path.relative` yields backslashes, which must never leak
  // into generated `package.json` export targets.
  const distRel = (path.relative(ctx.cwd, ctx.distPath) || 'dist').split(path.sep).join('/')
  const cssExportPaths = new Set(ctx.cssExports.map((cssExport) => cssExport._path))
  const cssSources: Record<string, string> = {}
  for (const cssExport of ctx.cssExports) {
    cssSources[cssExport._path] = cssExport.source
  }

  // alias -> hand-written subpath, e.g. `index` -> `.`, `sub/feature` -> `./feature`
  const aliasToExportPath = new Map<string, string>()
  for (const entry of build.entries) {
    if (entry.exportPath !== undefined) {
      aliasToExportPath.set(entry.alias, entry.exportPath)
    }
  }

  return (exportsMap, context) => {
    const {isPublish} = context

    // 1. Remap the generated keys (`.` for the `index` alias, `./<alias>` otherwise) back to
    //    the hand-written subpaths.
    const remapped: ExportsMap = {}
    for (const [key, value] of Object.entries(exportsMap)) {
      const alias = key === '.' ? 'index' : key.startsWith('./') ? key.slice(2) : key
      const exportPath = aliasToExportPath.get(alias) ?? key
      remapped[exportPath] = value
    }

    // 2. Reconcile each generated entry with its hand-written counterpart.
    const result: ExportsMap = {}
    const handwritten = ctx.exports || {}
    const sourceRaw: ExportsMap = pkg.exports || {}
    const publishRaw: ExportsMap | undefined = pkg.publishConfig?.exports
    const authoredRaw = isPublish && publishRaw ? publishRaw : sourceRaw

    const reconcile = (exportPath: string, value: unknown): unknown => {
      const exp = handwritten[exportPath]
      if (!exp) return value
      const raw = authoredRaw[exportPath]
      const source = sourceRaw[exportPath]
      // A configured exports map is itself authoritative. Otherwise use the raw package entry
      // for the map being generated. Fall back to `exports` when a new publish map/entry is
      // being generated, so inferred conditions don't masquerade as ordering choices.
      const authored =
        ctx.config?.exports === undefined
          ? isRecord(raw)
            ? raw
            : isRecord(source)
              ? source
              : exp
          : exp
      return reconcileEntry(exp, value, {authored, isPublish, type})
    }

    // 3. Follow the hand-written key order of the map being generated. Source-only passthrough
    //    subpaths missing from an existing publish map are appended, followed by generated extras.
    const authoredPaths = Object.keys(authoredRaw)
    for (const exportPath of Object.keys(sourceRaw)) {
      if (!Object.prototype.hasOwnProperty.call(authoredRaw, exportPath)) {
        authoredPaths.push(exportPath)
      }
    }
    for (const exportPath of authoredPaths) {
      if (exportPath in remapped) {
        result[exportPath] = reconcile(exportPath, remapped[exportPath])
      } else if (cssExportPaths.has(exportPath)) {
        // A `.css` subpath with a `source` is built by the stylesheet build, which does not
        // participate in exports generation (its entries are stylesheets, not JS). Its
        // conditions are materialized here instead, from the export subpath: `./ui/styles.css`
        // is built to `<dist>/ui/styles.css` with the shim next to it.
        result[exportPath] = reconcileCssEntry(exportPath, {
          distRel,
          source: cssSources[exportPath],
          isPublish,
        })
      } else {
        // Hand-written subpaths that aren't build entries (plain `.css`/`.json` exports,
        // `svelte` entries) pass through untouched.
        result[exportPath] = Object.prototype.hasOwnProperty.call(authoredRaw, exportPath)
          ? authoredRaw[exportPath]
          : sourceRaw[exportPath]
      }
    }
    for (const [exportPath, value] of Object.entries(remapped)) {
      if (exportPath in result) continue
      result[exportPath] = reconcile(exportPath, value)
    }

    return result
  }
}

/**
 * The conditional CSS export of a `.css` subpath built by the stylesheet build. `source`
 * resolves at development time, so it is kept in `exports` and stripped from the publish
 * variant — the same split the build entries get.
 */
function reconcileCssEntry(
  exportPath: string,
  options: {distRel: string; source: string | undefined; isPublish: boolean},
): Record<string, string> {
  const {distRel, source, isPublish} = options
  const cssName = exportPath.replace(/^\.\//, '')
  const conditions = createConditionalCssExport(cssName, distRel)
  return isPublish || source === undefined ? conditions : {source, ...conditions}
}

/**
 * Rebuilds a generated subpath entry in its authored condition order, re-inserting the
 * hand-written conditions tsdown's generator cannot express.
 */
function reconcileEntry(
  exp: PkgExport,
  generated: unknown,
  options: {authored: object; isPublish: boolean; type: 'commonjs' | 'module'},
): unknown {
  const {authored, isPublish, type} = options
  const authoredRecord = isRecord(authored) ? authored : {}

  // tsdown's publish variant of a single-format entry is a plain string
  const gen: Record<string, unknown> | undefined =
    typeof generated === 'string'
      ? {default: generated}
      : isRecord(generated)
        ? generated
        : undefined
  if (!gen) return generated

  const browserOrder = isRecord(authoredRecord['browser']) ? authoredRecord['browser'] : exp.browser
  const browser =
    exp.browser && (exp.browser.import || exp.browser.require)
      ? pickConditions(exp.browser, {
          authored: browserOrder ?? exp.browser,
          isPublish,
          type,
        })
      : undefined
  const nodeOrder = isRecord(authoredRecord['node']) ? authoredRecord['node'] : exp.node
  const node =
    exp.node && (exp.node.import || exp.node.require)
      ? pickConditions(exp.node, {
          authored: nodeOrder ?? exp.node,
          isPublish,
          type,
        })
      : undefined
  const custom = pickCustomConditions(exp)

  // Preserve tsdown's compact single-format publish shape unless hand-written conditions need
  // to be re-inserted. There is no condition ordering to preserve in a plain string entry.
  if (typeof generated === 'string' && !exp.types && !browser && !node && custom.length === 0) {
    return generated
  }

  const next: Record<string, unknown> = {}

  // `source`-like conditions resolve at development time and are stripped from the publish
  // variant (tsdown already does this for `source`; `development`/`monorepo` follow)
  if (!isPublish) {
    if (typeof gen['source'] === 'string') next['source'] = gen['source']
    else if (exp.source) next['source'] = exp.source
    if (exp.development) next['development'] = exp.development
    if (exp.monorepo) next['monorepo'] = exp.monorepo
  }

  if (exp.types) next['types'] = exp.types
  if (browser) next['browser'] = browser
  if (node) next['node'] = node

  // Hand-written custom conditions (`react-server`, `worker`, …) aren't built, but they are
  // the author's: carry their targets over, then restore every condition's authored position.
  for (const [condition, target] of custom) {
    const authoredTarget = authoredRecord[condition]
    next[condition] =
      isRecord(target) && isRecord(authoredTarget)
        ? preserveConditionOrder(target, authoredTarget)
        : target
  }

  if (typeof gen['import'] === 'string' && typeof gen['require'] === 'string') {
    next['import'] = gen['import']
    next['require'] = gen['require']
    // tsdown emits bare `import`/`require` pairs; the Sanity convention ends with `default`
    next['default'] = type === 'module' ? gen['import'] : gen['require']
  } else {
    // Single-format entries keep the generated shape (`{source, default}` in development)
    for (const [condition, target] of Object.entries(gen)) {
      if (condition in next || condition === 'source') continue
      next[condition] = target
    }
  }

  return preserveConditionOrder(next, authored)
}

/**
 * The hand-written `browser`/`node` condition object, minus `source` for the publish map.
 * A nested runtime condition must have its own fallback: once a resolver matches `node` or
 * `browser`, an unmatched module-format condition otherwise backtracks to the outer entry.
 */
function pickConditions(
  conditions: {source?: string; import?: string; require?: string; default?: string},
  options: {
    authored?: object
    isPublish: boolean
    type: 'commonjs' | 'module'
  },
): Record<string, string> {
  const {authored = conditions, isPublish, type} = options
  const next: Record<string, string> = {}
  if (!isPublish && conditions.source) next['source'] = conditions.source
  if (conditions.import) next['import'] = conditions.import
  if (conditions.require) next['require'] = conditions.require
  const fallback =
    conditions.default ?? (type === 'module' ? conditions.import : conditions.require)
  if (fallback) next['default'] = fallback
  return preserveConditionOrder(next, authored)
}

/**
 * Reorders reconciled conditions to match their hand-written order. Conditions generated by
 * tsdown but absent from the hand-written entry are inserted before its `default` fallback.
 */
function preserveConditionOrder<T>(
  conditions: Record<string, T>,
  authored: object,
): Record<string, T> {
  const entries: [string, T][] = []
  const added = new Set<string>()
  const conditionEntries = Object.entries(conditions)
  const entriesByCondition = new Map(conditionEntries.map((entry) => [entry[0], entry]))
  const authoredOrder = Object.keys(authored).filter((condition) => !condition.startsWith('_'))
  const authoredConditions = new Set(authoredOrder)

  const addGeneratedConditions = () => {
    for (const entry of conditionEntries) {
      if (!authoredConditions.has(entry[0]) && !added.has(entry[0])) {
        entries.push(entry)
        added.add(entry[0])
      }
    }
  }

  for (const condition of authoredOrder) {
    // A generated condition has no authored position. Keep the explicit `default` as the final
    // fallback by placing generated conditions immediately before it.
    if (condition === 'default') addGeneratedConditions()
    const entry = entriesByCondition.get(condition)
    if (!entry) continue
    entries.push(entry)
    added.add(condition)
  }

  addGeneratedConditions()

  return Object.fromEntries(entries)
}

/** The conditions the pipeline owns (or re-inserts itself) on a build entry. */
const managedConditions = new Set([
  'source',
  'development',
  'monorepo',
  'types',
  'browser',
  'node',
  'import',
  'require',
  'default',
])

/**
 * Hand-written conditions the pipeline knows nothing about (`react-server`, `worker`,
 * `edge-light`, …), in authored order. `parseExports` spreads the raw entry, so they survive
 * on the parsed `PkgExport` beyond its typed fields.
 */
function pickCustomConditions(exp: PkgExport): [string, unknown][] {
  return Object.entries(exp).filter(
    ([condition, target]) =>
      !managedConditions.has(condition) && !condition.startsWith('_') && target !== undefined,
  )
}
