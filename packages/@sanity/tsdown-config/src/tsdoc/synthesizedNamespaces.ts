import {existsSync, readFileSync} from 'node:fs'
import path from 'node:path'
// The JS compiler API is loaded from the official `@typescript/typescript6` compat package
// instead of the `typescript` peer dependency, as TypeScript 7 (the Go-native compiler) no longer
// ships it
import ts from '@typescript/typescript6'

/**
 * The exports-object identifiers of rolldown's namespace interop: `<module>_exports` (the
 * declaration bundling pass names them after the virtual declaration module, e.g. `inner.d.ts`
 * → `inner_d_exports`), with rolldown's `$<n>` suffix when deconflicting renames one.
 */
const RE_WRAPPER_NAME = /_exports(\$\d+)?$/

/** Matches the relative specifiers of emitted sibling chunks (`./chunk-<hash>.js`). */
const RE_RELATIVE_SPECIFIER = /^\.\.?\//

/**
 * Finds the local names of the `declare namespace <name>_exports {…}` wrappers that the
 * declaration bundling pass (tsdown / rolldown-plugin-dts) synthesizes for namespace re-exports
 * like `export * as ns from './module'` (or `import * as ns` + `export {ns}`).
 *
 * Bundling loses the doc comment of the re-export statement, so the wrapper cannot carry a
 * release tag — there is no way to tag it from userland, and API Extractor would flag it with
 * `ae-missing-release-tag` (https://github.com/sanity-io/pkg-utils/issues/3281). Skipping it
 * matches how API Extractor treats the equivalent namespace of its own rollups (it never
 * checks those). The members re-exported through the wrapper keep their own doc comments in
 * the output; API Extractor does not flag them individually either way (only directly exported
 * declarations are consumable entities of the missing-release-tag check).
 *
 * A name only qualifies when all of these hold, so user-authored symbols that merely resemble
 * the interop naming stay checked:
 *
 * - it matches rolldown's `<module>_exports` naming (with an optional `$<n>` deconflict suffix)
 * - it is declared as a namespace — in the entry itself, or in a sibling chunk the entry
 *   imports (a wrapper shared by several entries lives in the chunk that owns the module's
 *   declarations)
 * - that namespace has the synthesized body shape: nothing but `export { … };` specifier lists
 *   pointing at sibling declarations of the same file. A user-authored namespace declares its
 *   own members (`declare namespace config_exports { const userValue: string; }`), and those
 *   members are what the author tags — so it stays checked even when the bundler's
 *   deconflicting hands it a wrapper-shaped name
 * - the entry does not export the name unaliased: a synthesized wrapper is always re-exported
 *   under the alias of the original namespace re-export (`export { inner_d_exports as inner }`),
 *   while an unaliased export (`export { foo_exports }`, `export declare namespace foo_exports`)
 *   is a name the author chose — and can tag
 * @internal
 */
export function collectSynthesizedNamespaceWrappers(entryDtsFile: string): Set<string> {
  const entry = parseDts(entryDtsFile)
  if (!entry) return new Set()

  const unaliasedExports = new Set<string>()
  const wrapperShapedNames = new Set<string>()
  const chunkFiles = new Set<string>()

  for (const statement of entry.statements) {
    collectWrapperShapedNamespaceName(statement, wrapperShapedNames)

    if (ts.isExportDeclaration(statement)) {
      const {exportClause} = statement
      if (exportClause && ts.isNamedExports(exportClause)) {
        for (const element of exportClause.elements) {
          if (!element.propertyName || element.propertyName.text === element.name.text) {
            unaliasedExports.add(element.name.text)
          }
        }
      } else if (exportClause && ts.isNamespaceExport(exportClause)) {
        unaliasedExports.add(exportClause.name.text)
      }
      collectChunkFile(entryDtsFile, statement.moduleSpecifier, chunkFiles)
    } else if (ts.isImportDeclaration(statement)) {
      collectChunkFile(entryDtsFile, statement.moduleSpecifier, chunkFiles)
    } else {
      collectExportedDeclarationNames(statement, unaliasedExports)
    }
  }

  for (const chunkFile of chunkFiles) {
    const chunk = parseDts(chunkFile)
    if (!chunk) continue
    for (const statement of chunk.statements) {
      collectWrapperShapedNamespaceName(statement, wrapperShapedNames)
    }
  }

  const wrappers = new Set<string>()
  for (const name of wrapperShapedNames) {
    if (RE_WRAPPER_NAME.test(name) && !unaliasedExports.has(name)) wrappers.add(name)
  }
  return wrappers
}

function parseDts(filePath: string): ts.SourceFile | undefined {
  if (!existsSync(filePath)) return undefined
  return ts.createSourceFile(
    filePath,
    readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    false,
  )
}

/**
 * Collects the name of a top-level `declare namespace <Identifier> {…}` statement whose body has
 * the shape the declaration bundling pass synthesizes: only `export { … };` specifier lists
 * naming sibling declarations of the same file, never members of its own. Every namespace
 * re-export the bundler rewrites comes out that way, whatever the re-exported module holds
 * (values, types, a default export, further namespace re-exports).
 */
function collectWrapperShapedNamespaceName(statement: ts.Statement, names: Set<string>): void {
  if (
    !ts.isModuleDeclaration(statement) ||
    !ts.isIdentifier(statement.name) ||
    (statement.flags & ts.NodeFlags.Namespace) === 0
  ) {
    return
  }

  const {body} = statement
  if (!body || !ts.isModuleBlock(body)) return

  const onlyReExportsSiblings = body.statements.every(
    (member) =>
      ts.isExportDeclaration(member) &&
      !member.moduleSpecifier &&
      member.exportClause !== undefined &&
      ts.isNamedExports(member.exportClause),
  )
  if (!onlyReExportsSiblings) return

  names.add(statement.name.text)
}

/**
 * Collects the names a declaration with an `export` modifier exports directly, e.g.
 * `export declare namespace foo_exports {…}` — those names are user-chosen (the author can
 * tag them), unlike the alias-only re-export of a synthesized wrapper.
 */
function collectExportedDeclarationNames(statement: ts.Statement, names: Set<string>): void {
  const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined
  if (!modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) return

  if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) names.add(declaration.name.text)
    }
  } else if (
    (ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isEnumDeclaration(statement)) &&
    statement.name
  ) {
    names.add(statement.name.text)
  } else if (ts.isModuleDeclaration(statement) && ts.isIdentifier(statement.name)) {
    names.add(statement.name.text)
  }
}

/**
 * Resolves the sibling chunk file a relative import/export specifier points at, mapping the
 * runtime extension to the declaration extension the chunk is emitted with on disk
 * (`./chunk.js` → `./chunk.d.ts`, like the declaration output of the bundling pass itself).
 */
function collectChunkFile(
  entryDtsFile: string,
  moduleSpecifier: ts.Expression | undefined,
  files: Set<string>,
): void {
  if (!moduleSpecifier || !ts.isStringLiteral(moduleSpecifier)) return
  const specifier = moduleSpecifier.text
  if (!RE_RELATIVE_SPECIFIER.test(specifier)) return
  const dtsFile = specifierToDtsFile(specifier)
  if (!dtsFile) return
  files.add(path.resolve(path.dirname(entryDtsFile), dtsFile))
}

/** `./chunk.js` → `./chunk.d.ts` (`.mjs` → `.d.mts`, `.cjs` → `.d.cts`). */
function specifierToDtsFile(specifier: string): string | undefined {
  if (/\.d\.[mc]?ts$/.test(specifier)) return specifier
  if (specifier.endsWith('.mjs')) return `${specifier.slice(0, -4)}.d.mts`
  if (specifier.endsWith('.cjs')) return `${specifier.slice(0, -4)}.d.cts`
  if (specifier.endsWith('.js')) return `${specifier.slice(0, -3)}.d.ts`
  return undefined
}
