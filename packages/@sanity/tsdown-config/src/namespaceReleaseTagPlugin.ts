import {readFile} from 'node:fs/promises'
import path from 'node:path'
import type ts from '@typescript/typescript6'
import type {Rolldown} from 'tsdown'

const RE_DTS_FILE = /\.d\.(ts|mts|cts)$/
const RE_NAMESPACE_REEXPORT = /\b(?:export\s+(?:type\s+)?\*\s*as|import\s+(?:type\s+)?\*\s*as)\s+/
const RE_RELEASE_TAG = /@(alpha|beta|internal|public)\b/
const RELEASE_TAGS = new Set(['alpha', 'beta', 'internal', 'public'])

type ReleaseTag = 'alpha' | 'beta' | 'internal' | 'public'

interface EntrySource {
  name?: string
  sourcePath: string
  declarationPath: string
}

/**
 * Restores release tags on the namespace declarations that rolldown-plugin-dts synthesizes for
 * `export * as name` and `import * as name; export {name}` declarations. The declaration plugin
 * currently drops the source statement's comments before its `patchTsNamespace` pass, leaving API
 * Extractor to report an unfixable `ae-missing-release-tag` error against the generated
 * `<module>_d_exports` identifier.
 *
 * @internal
 */
export function namespaceReleaseTagPlugin(): Rolldown.Plugin {
  let entrySources: EntrySource[] = []

  return {
    name: 'sanity-namespace-release-tags',

    buildStart({cwd, input}) {
      entrySources = Array.isArray(input)
        ? input.map((sourcePath) => entrySource(cwd, sourcePath))
        : Object.entries(input).map(([name, sourcePath]) => entrySource(cwd, sourcePath, name))
    },

    renderChunk: {
      order: 'post',
      async handler(code, chunk) {
        if (!chunk.isEntry || !RE_DTS_FILE.test(chunk.fileName)) return undefined

        const sourcePath = sourcePathForChunk(chunk, entrySources)
        if (!sourcePath) return undefined

        const sourceText = await readFile(sourcePath, 'utf8').catch(() => undefined)
        if (
          sourceText === undefined ||
          !RE_NAMESPACE_REEXPORT.test(sourceText) ||
          !RE_RELEASE_TAG.test(sourceText)
        ) {
          return undefined
        }
        const {default: typescript} = await import('@typescript/typescript6')
        const insertions = namespaceReleaseTagInsertions(
          typescript,
          sourcePath,
          sourceText,
          chunk.fileName,
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

function entrySource(cwd: string, sourcePath: string, name?: string): EntrySource {
  const absolutePath = path.resolve(cwd, sourcePath)
  return {
    name,
    sourcePath: absolutePath,
    declarationPath: sourceToDeclarationPath(absolutePath),
  }
}

function sourceToDeclarationPath(sourcePath: string): string {
  if (RE_DTS_FILE.test(sourcePath)) return sourcePath
  if (sourcePath.endsWith('.mts') || sourcePath.endsWith('.mjs')) {
    return sourcePath.replace(/\.(mts|mjs)$/, '.d.mts')
  }
  if (sourcePath.endsWith('.cts') || sourcePath.endsWith('.cjs')) {
    return sourcePath.replace(/\.(cts|cjs)$/, '.d.cts')
  }
  return sourcePath.replace(/\.(tsx?|jsx?)$/, '.d.ts')
}

function sourcePathForChunk(
  chunk: Pick<Rolldown.RenderedChunk, 'facadeModuleId' | 'name'>,
  entries: EntrySource[],
): string | undefined {
  const facadeModuleId = chunk.facadeModuleId && path.normalize(chunk.facadeModuleId)
  if (facadeModuleId) {
    const exact = entries.find(
      ({declarationPath, sourcePath}) =>
        path.normalize(declarationPath) === facadeModuleId ||
        sourceStem(path.normalize(sourcePath)) === declarationStem(facadeModuleId),
    )
    if (exact) return exact.sourcePath
  }

  const entryName = chunk.name.endsWith('.d') ? chunk.name.slice(0, -2) : chunk.name
  return entries.find(({name}) => name === entryName)?.sourcePath
}

function sourceStem(sourcePath: string): string {
  return sourcePath.replace(/\.d\.[mc]?ts$/, '').replace(/\.(?:[mc]?[jt]sx?)$/, '')
}

function declarationStem(declarationPath: string): string {
  return declarationPath.replace(/\.d\.[mc]?ts$/, '')
}

function namespaceReleaseTagInsertions(
  typescript: typeof ts,
  sourcePath: string,
  sourceText: string,
  declarationPath: string,
  declarationText: string,
): Array<{position: number; tag: ReleaseTag}> {
  const sourceFile = typescript.createSourceFile(
    sourcePath,
    sourceText,
    typescript.ScriptTarget.Latest,
    true,
  )
  const tagsByExportName = new Map<string, ReleaseTag>()
  const namespaceImports = new Map<string, ReleaseTag | undefined>()

  for (const statement of sourceFile.statements) {
    const namedBindings =
      typescript.isImportDeclaration(statement) && statement.importClause?.namedBindings
    if (!namedBindings || !typescript.isNamespaceImport(namedBindings)) continue
    namespaceImports.set(namedBindings.name.text, getReleaseTag(typescript, statement))
  }

  for (const statement of sourceFile.statements) {
    if (!typescript.isExportDeclaration(statement) || !statement.exportClause) continue

    if (typescript.isNamespaceExport(statement.exportClause)) {
      const releaseTag = getReleaseTag(typescript, statement)
      if (releaseTag) tagsByExportName.set(statement.exportClause.name.text, releaseTag)
      continue
    }

    if (statement.moduleSpecifier || !typescript.isNamedExports(statement.exportClause)) continue
    const exportReleaseTag = getReleaseTag(typescript, statement)
    for (const specifier of statement.exportClause.elements) {
      const localName = specifier.propertyName?.text ?? specifier.name.text
      if (!namespaceImports.has(localName)) continue
      const importReleaseTag = namespaceImports.get(localName)
      const releaseTag =
        exportReleaseTag && importReleaseTag && exportReleaseTag !== importReleaseTag
          ? undefined
          : (exportReleaseTag ?? importReleaseTag)
      if (releaseTag) tagsByExportName.set(specifier.name.text, releaseTag)
    }
  }
  if (tagsByExportName.size === 0) return []

  const declarationFile = typescript.createSourceFile(
    declarationPath,
    declarationText,
    typescript.ScriptTarget.Latest,
    true,
  )
  const namespaces = new Map<string, ts.ModuleDeclaration>()
  for (const statement of declarationFile.statements) {
    if (isSyntheticNamespace(typescript, statement)) {
      namespaces.set(statement.name.text, statement)
    }
  }

  const tagsByPosition = new Map<number, ReleaseTag>()
  const conflictingPositions = new Set<number>()
  for (const statement of declarationFile.statements) {
    if (
      !typescript.isExportDeclaration(statement) ||
      statement.moduleSpecifier ||
      !statement.exportClause ||
      !typescript.isNamedExports(statement.exportClause)
    ) {
      continue
    }

    for (const specifier of statement.exportClause.elements) {
      if (!specifier.propertyName) continue
      const releaseTag = tagsByExportName.get(specifier.name.text)
      const namespace = namespaces.get(specifier.propertyName.text)
      if (!releaseTag || !namespace || getReleaseTag(typescript, namespace)) continue

      const position = namespace.getStart(declarationFile)
      const previousTag = tagsByPosition.get(position)
      if (previousTag && previousTag !== releaseTag) {
        conflictingPositions.add(position)
      } else {
        tagsByPosition.set(position, releaseTag)
      }
    }
  }

  return [...tagsByPosition]
    .filter(([position]) => !conflictingPositions.has(position))
    .map(([position, tag]) => ({position, tag}))
    .toSorted((a, b) => b.position - a.position)
}

function isSyntheticNamespace(
  typescript: typeof ts,
  statement: ts.Statement,
): statement is ts.ModuleDeclaration & {name: ts.Identifier; body: ts.ModuleBlock} {
  if (
    !typescript.isModuleDeclaration(statement) ||
    !typescript.isIdentifier(statement.name) ||
    !statement.name.text.endsWith('_exports') ||
    !statement.modifiers?.some(({kind}) => kind === typescript.SyntaxKind.DeclareKeyword) ||
    !statement.body ||
    !typescript.isModuleBlock(statement.body) ||
    statement.body.statements.length !== 1
  ) {
    return false
  }

  const [namespaceExport] = statement.body.statements
  return (
    !!namespaceExport &&
    typescript.isExportDeclaration(namespaceExport) &&
    !namespaceExport.moduleSpecifier &&
    !!namespaceExport.exportClause &&
    typescript.isNamedExports(namespaceExport.exportClause)
  )
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
