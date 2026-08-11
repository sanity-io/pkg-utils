import type ts from '@typescript/typescript6'
import type {Rolldown} from 'tsdown'

const RE_DTS_FILE = /\.d\.(?:ts|mts|cts)$/
const RE_SYNTHETIC_NAMESPACE = /\bdeclare\s+namespace\s+\S+_exports\b/
const RE_NAMESPACE_REEXPORT = /\b(?:export\s+(?:type\s+)?\*\s*as|import\s+(?:type\s+)?\*\s*as)\s+/
const NAMESPACE_ALIAS_META = 'sanityNamespaceReleaseTags'
const RELEASE_TAGS = new Set(['alpha', 'beta', 'internal', 'public'])

type ReleaseTag = 'alpha' | 'beta' | 'internal' | 'public'

interface NamespaceAlias {
  exportName: string
  releaseTag: ReleaseTag | undefined
  targetId: string
}

interface UnresolvedNamespaceAlias {
  exportName: string
  moduleSpecifier: string
  releaseTag: ReleaseTag | undefined
}

type AliasesByTarget = Map<string, NamespaceAlias[]>
type AliasesByDeclaration = Map<string, AliasesByTarget>

/**
 * Restores release tags on the namespace declarations that rolldown-plugin-dts synthesizes for
 * `export * as name` and `import * as name; export {name}` declarations. A pre-transform sees
 * each emitted declaration module while its source comments are still present and records only
 * namespace aliases; the post-render hook matches those aliases to the generated wrappers.
 *
 * @internal
 */
export function namespaceReleaseTagPlugin(): Rolldown.Plugin {
  // `mergeConfig` deliberately reuses input plugin objects, including when tsdown starts its ESM
  // and CJS declaration passes concurrently. Direct hook invocations (and Rollup-compatible
  // hosts that preserve their context object) stay partitioned by context here. Rolldown creates
  // a fresh JavaScript context wrapper for each hook call, so transform metadata is also stored
  // on its build-local ModuleInfo below and recovered through the current render context.
  const aliasesByContext = new WeakMap<Rolldown.PluginContext, AliasesByDeclaration>()
  // Module IDs are only an index into build-local ModuleInfo metadata; no alias data lives here,
  // so concurrent builds with identical IDs cannot overwrite one another.
  const declarationIds = new Set<string>()

  return {
    name: 'sanity-namespace-release-tags',

    transform: {
      order: 'pre',
      filter: {id: RE_DTS_FILE},
      async handler(code, id) {
        const declarationId = normalizeModuleId(id)

        // Every ordinary declaration module stops here: no parser import, resolution, or graph read.
        if (!RE_NAMESPACE_REEXPORT.test(code)) {
          aliasesByContext.get(this)?.delete(declarationId)
          return declarationIds.has(declarationId)
            ? {meta: {[NAMESPACE_ALIAS_META]: undefined}}
            : undefined
        }

        const {default: typescript} = await import('@typescript/typescript6')
        const unresolvedAliases = collectNamespaceAliases(typescript, id, code)
        const targetIds = new Map<string, Promise<string | undefined>>()
        const resolveTarget = (moduleSpecifier: string): Promise<string | undefined> => {
          let targetId = targetIds.get(moduleSpecifier)
          if (!targetId) {
            targetId = this.resolve(moduleSpecifier, id).then((resolved) =>
              resolved && !resolved.external ? normalizeModuleId(resolved.id) : undefined,
            )
            targetIds.set(moduleSpecifier, targetId)
          }
          return targetId
        }

        const aliasesByTarget: AliasesByTarget = new Map()
        for (const alias of unresolvedAliases) {
          const targetId = await resolveTarget(alias.moduleSpecifier)
          if (!targetId) continue
          const resolvedAlias: NamespaceAlias = {
            exportName: alias.exportName,
            releaseTag: alias.releaseTag,
            targetId,
          }
          const aliases = aliasesByTarget.get(targetId)
          if (aliases) aliases.push(resolvedAlias)
          else aliasesByTarget.set(targetId, [resolvedAlias])
        }

        declarationIds.add(declarationId)
        const contextAliases = aliasesForContext(aliasesByContext, this)
        if (aliasesByTarget.size === 0) {
          contextAliases.delete(declarationId)
        } else {
          contextAliases.set(declarationId, aliasesByTarget)
        }
        return {
          meta: {
            [NAMESPACE_ALIAS_META]: aliasesByTarget.size === 0 ? undefined : aliasesByTarget,
          },
        }
      },
    },

    watchChange(id) {
      // Authored dtsInput modules have their real declaration identity here. Generated declaration
      // modules are refreshed by their next transform, which atomically replaces this entry.
      aliasesByContext.get(this)?.delete(normalizeModuleId(id))
    },

    renderChunk: {
      order: 'post',
      async handler(code, chunk, _outputOptions, meta) {
        if (!RE_DTS_FILE.test(chunk.fileName) || !RE_SYNTHETIC_NAMESPACE.test(code)) {
          return undefined
        }

        const moduleRenderedExports = renderedExportsByModule(chunk, meta.chunks)
        const aliases = activeNamespaceAliases(
          this,
          aliasesByContext,
          declarationIds,
          moduleRenderedExports,
        )
        if (aliases.length === 0) return undefined

        const insertions = namespaceReleaseTagInsertions(
          aliases,
          new Set(Object.keys(chunk.modules).map(normalizeModuleId)),
          moduleRenderedExports,
          code,
        )
        if (insertions.length === 0) return undefined

        // Rolldown's native `meta.magicString` still represents the chunk from before an earlier
        // renderChunk hook returned replacement code. rolldown-plugin-dts does exactly that, so
        // create a map-producing editor over the current declaration text instead.
        const {default: MagicString} = await import('magic-string')
        const magicString = new MagicString(code)
        for (const {position, tag} of insertions) {
          magicString.prependLeft(position, `/** @${tag} */ `)
        }
        return {
          code: magicString.toString(),
          map: magicString.generateMap({hires: 'boundary', includeContent: true}),
        }
      },
    },
  }
}

function aliasesForContext(
  aliasesByContext: WeakMap<Rolldown.PluginContext, AliasesByDeclaration>,
  context: Rolldown.PluginContext,
): AliasesByDeclaration {
  const existing = aliasesByContext.get(context)
  if (existing) return existing
  const aliases = new Map<string, AliasesByTarget>()
  aliasesByContext.set(context, aliases)
  return aliases
}

function collectNamespaceAliases(
  typescript: typeof ts,
  declarationPath: string,
  declarationText: string,
): UnresolvedNamespaceAlias[] {
  const sourceFile = typescript.createSourceFile(
    declarationPath,
    declarationText,
    typescript.ScriptTarget.Latest,
    true,
  )
  const namespaceImports = new Map<
    string,
    {moduleSpecifier: string; releaseTag: ReleaseTag | undefined}
  >()
  const aliases: UnresolvedNamespaceAlias[] = []

  for (const statement of sourceFile.statements) {
    const namedBindings =
      typescript.isImportDeclaration(statement) && statement.importClause?.namedBindings
    if (
      !namedBindings ||
      !typescript.isNamespaceImport(namedBindings) ||
      !typescript.isStringLiteral(statement.moduleSpecifier)
    ) {
      continue
    }
    namespaceImports.set(namedBindings.name.text, {
      moduleSpecifier: statement.moduleSpecifier.text,
      releaseTag: getReleaseTag(typescript, statement),
    })
  }

  for (const statement of sourceFile.statements) {
    if (!typescript.isExportDeclaration(statement) || !statement.exportClause) continue

    if (
      typescript.isNamespaceExport(statement.exportClause) &&
      statement.moduleSpecifier &&
      typescript.isStringLiteral(statement.moduleSpecifier)
    ) {
      aliases.push({
        exportName: statement.exportClause.name.text,
        moduleSpecifier: statement.moduleSpecifier.text,
        releaseTag: getReleaseTag(typescript, statement),
      })
      continue
    }

    if (statement.moduleSpecifier || !typescript.isNamedExports(statement.exportClause)) continue
    const exportReleaseTag = getReleaseTag(typescript, statement)
    for (const specifier of statement.exportClause.elements) {
      const localName = specifier.propertyName?.text ?? specifier.name.text
      const namespaceImport = namespaceImports.get(localName)
      if (!namespaceImport) continue
      const importReleaseTag = namespaceImport.releaseTag
      aliases.push({
        exportName: specifier.name.text,
        moduleSpecifier: namespaceImport.moduleSpecifier,
        releaseTag:
          exportReleaseTag && importReleaseTag && exportReleaseTag !== importReleaseTag
            ? undefined
            : (exportReleaseTag ?? importReleaseTag),
      })
    }
  }

  return aliases
}

function activeNamespaceAliases(
  context: Rolldown.PluginContext,
  aliasesByContext: WeakMap<Rolldown.PluginContext, AliasesByDeclaration>,
  declarationIds: Set<string>,
  moduleRenderedExports: Map<string, Set<string>>,
): NamespaceAlias[] {
  let aliasesByDeclaration = aliasesByContext.get(context)
  if (!aliasesByDeclaration) {
    aliasesByDeclaration = new Map()
    for (const declarationId of declarationIds) {
      const moduleInfo = context.getModuleInfo(declarationId)
      if (!moduleInfo) continue
      const aliasesByTarget = moduleInfo.meta[NAMESPACE_ALIAS_META]
      if (aliasesByTarget instanceof Map) {
        aliasesByDeclaration.set(declarationId, aliasesByTarget as AliasesByTarget)
      }
    }
  }

  const allRenderedExports = new Set<string>()
  for (const exportNames of moduleRenderedExports.values()) {
    for (const exportName of exportNames) allRenderedExports.add(exportName)
  }
  const aliases: NamespaceAlias[] = []

  for (const [declarationId, aliasesByTarget] of aliasesByDeclaration) {
    // Prefer this declaration module's own output metadata. A transitive declaration barrel can
    // be collapsed out of the final chunks; in that case names rendered by any declaration module
    // still identify ordinary (non-renamed) aliases. If none of the authored names remain, retain
    // the aliases as structural candidates: a later barrel may have renamed every one of them.
    const renderedExports = moduleRenderedExports.get(declarationId) ?? allRenderedExports
    const declarationAliases = [...aliasesByTarget.values()].flat()
    const hasRenderedAuthoredName = declarationAliases.some(({exportName}) =>
      renderedExports.has(exportName),
    )
    if (renderedExports.size === 0) continue
    for (const targetAliases of aliasesByTarget.values()) {
      aliases.push(
        ...(hasRenderedAuthoredName
          ? targetAliases.filter(({exportName}) => renderedExports.has(exportName))
          : targetAliases),
      )
    }
  }

  return aliases
}

function renderedExportsByModule(
  chunk: Pick<Rolldown.RenderedChunk, 'modules'>,
  chunks: Record<string, Rolldown.RenderedChunk>,
): Map<string, Set<string>> {
  const renderedExports = new Map<string, Set<string>>()
  const addChunk = ({modules}: Pick<Rolldown.RenderedChunk, 'modules'>): void => {
    for (const [id, renderedModule] of Object.entries(modules)) {
      const normalizedId = normalizeModuleId(id)
      if (!RE_DTS_FILE.test(normalizedId)) continue
      const exportNames = renderedExports.get(normalizedId)
      if (exportNames) {
        for (const exportName of renderedModule.renderedExports) exportNames.add(exportName)
      } else {
        renderedExports.set(normalizedId, new Set(renderedModule.renderedExports))
      }
    }
  }
  for (const renderedChunk of Object.values(chunks)) addChunk(renderedChunk)
  // Rolldown's `meta.chunks` may omit the chunk whose hook is currently running.
  addChunk(chunk)
  return renderedExports
}

function namespaceReleaseTagInsertions(
  aliases: NamespaceAlias[],
  chunkModuleIds: Set<string>,
  moduleRenderedExports: Map<string, Set<string>>,
  declarationText: string,
): Array<{position: number; tag: ReleaseTag}> {
  const namespaces = new Map<
    string,
    {
      aliases: NamespaceAlias[]
      exportedMembers: Set<string>
      hasReleaseTag: boolean
      position: number
      targetIds: Set<string>
    }
  >()

  for (const match of declarationText.matchAll(/\bdeclare\s+namespace\s+([^\s{]+_exports)\s*\{/g)) {
    const name = match[1]
    if (!name) continue
    const position = match.index
    const openingBrace = position + match[0].lastIndexOf('{')
    const closingBrace = matchingClosingBrace(declarationText, openingBrace)
    if (closingBrace === undefined) continue
    const prefix = declarationText.slice(0, position)
    const jsDocStart = prefix.lastIndexOf('/**')
    const precedingJsDoc =
      jsDocStart === -1 ? undefined : prefix.slice(jsDocStart).match(/^\/\*\*[\s\S]*?\*\/\s*$/)?.[0]
    namespaces.set(name, {
      aliases: [],
      exportedMembers: renderedExportNames(declarationText.slice(openingBrace + 1, closingBrace)),
      hasReleaseTag: !!precedingJsDoc && /@(alpha|beta|internal|public)\b/.test(precedingJsDoc),
      position,
      targetIds: new Set(),
    })
  }

  const aliasesByExportName = new Map<string, NamespaceAlias[]>()
  for (const alias of aliases) {
    const namedAliases = aliasesByExportName.get(alias.exportName)
    if (namedAliases) namedAliases.push(alias)
    else aliasesByExportName.set(alias.exportName, [alias])
  }
  // The rendered export specifiers identify which authored aliases survived tree-shaking.
  for (const match of declarationText.matchAll(/\bexport\s+(?:type\s+)?\{([^}]*)\}\s*;/g)) {
    for (const renderedSpecifier of (match[1] ?? '').split(',')) {
      const [localName, exportName = localName] = renderedSpecifier
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)
      if (!localName || !exportName) continue
      const namespace = namespaces.get(localName)
      if (!namespace) continue
      for (const alias of aliasesByExportName.get(exportName) ?? []) {
        if (!chunkModuleIds.has(alias.targetId)) continue
        namespace.aliases.push(alias)
        namespace.targetIds.add(alias.targetId)
      }
    }
  }

  // A shared declaration chunk can export wrappers under generated inter-chunk aliases, while
  // transitive barrels can rename every authored alias. Match each unresolved wrapper's complete
  // exported-member set to the target modules' tree-shaken rendered exports. Both ends must be
  // unique; an ambiguous structural match never invents a release tag.
  const claimedTargets = new Set<string>()
  for (const namespace of namespaces.values()) {
    if (namespace.targetIds.size === 1) {
      const [targetId] = namespace.targetIds
      if (targetId) claimedTargets.add(targetId)
    }
  }
  const aliasesByTarget = new Map<string, NamespaceAlias[]>()
  for (const alias of aliases) {
    if (claimedTargets.has(alias.targetId)) continue
    const targetAliases = aliasesByTarget.get(alias.targetId)
    if (targetAliases) targetAliases.push(alias)
    else aliasesByTarget.set(alias.targetId, [alias])
  }
  const unresolvedNamespaces = [...namespaces.values()].filter(
    (namespace) => namespace.aliases.length === 0,
  )
  const structuralMatches = unresolvedNamespaces.map((namespace) => ({
    namespace,
    targetIds: [...aliasesByTarget.keys()].filter((targetId) => {
      const targetExports = moduleRenderedExports.get(targetId)
      return (
        targetExports !== undefined && equalStringSets(namespace.exportedMembers, targetExports)
      )
    }),
  }))
  const targetMatchCounts = new Map<string, number>()
  for (const {targetIds} of structuralMatches) {
    for (const targetId of targetIds) {
      targetMatchCounts.set(targetId, (targetMatchCounts.get(targetId) ?? 0) + 1)
    }
  }
  for (const {namespace, targetIds} of structuralMatches) {
    const [targetId] = targetIds
    if (targetIds.length === 1 && targetId && targetMatchCounts.get(targetId) === 1) {
      const targetAliases = aliasesByTarget.get(targetId)
      if (!targetAliases) continue
      namespace.targetIds.add(targetId)
      namespace.aliases.push(...targetAliases)
    }
  }

  const insertions: Array<{position: number; tag: ReleaseTag}> = []
  for (const {
    aliases: referencedAliases,
    hasReleaseTag,
    position,
    targetIds,
  } of namespaces.values()) {
    if (targetIds.size !== 1 || referencedAliases.length === 0 || hasReleaseTag) {
      continue
    }
    const tags = new Set(referencedAliases.map(({releaseTag}) => releaseTag))
    if (tags.size !== 1 || tags.has(undefined)) continue
    const [tag] = tags
    if (tag) insertions.push({position, tag})
  }

  return insertions.toSorted((a, b) => b.position - a.position)
}

function matchingClosingBrace(text: string, openingBrace: number): number | undefined {
  let depth = 0
  for (let index = openingBrace; index < text.length; index++) {
    const character = text[index]
    if (character === '{') depth++
    else if (character === '}' && --depth === 0) return index
  }
  return undefined
}

function renderedExportNames(namespaceBody: string): Set<string> {
  const exportNames = new Set<string>()
  for (const match of namespaceBody.matchAll(/\bexport\s+(?:type\s+)?\{([^}]*)\}\s*;/g)) {
    for (const renderedSpecifier of (match[1] ?? '').split(',')) {
      const normalizedSpecifier = renderedSpecifier.trim().replace(/^type\s+/, '')
      if (!normalizedSpecifier) continue
      const [localName, exportName = localName] = normalizedSpecifier.split(/\s+as\s+/)
      if (exportName) exportNames.add(exportName)
    }
  }
  return exportNames
}

function equalStringSets(left: Set<string>, right: Set<string>): boolean {
  return left.size > 0 && left.size === right.size && [...left].every((value) => right.has(value))
}

function getReleaseTag(typescript: typeof ts, node: ts.Node): ReleaseTag | undefined {
  const tags = new Set(
    typescript
      .getJSDocTags(node)
      .map(({tagName}) => tagName.text)
      .filter((tag): tag is ReleaseTag => RELEASE_TAGS.has(tag)),
  )
  return tags.size === 1 ? tags.values().next().value : undefined
}

function normalizeModuleId(id: string): string {
  return id.replace(/[?#].*$/, '')
}
