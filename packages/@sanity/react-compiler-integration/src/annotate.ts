/**
 * The directive-injection transform: walks the oxc-shaped TS-ESTree AST (as produced by
 * `yuku-parser`, the same backend `@sanity/vanilla-extract-integration` uses) for allow-listed
 * {@link Surface} objects and splices a `'use memo'` directive into each matching
 * function-valued property, so `babel-plugin-react-compiler` compiles them in place.
 *
 * `infer` mode never compiles object-property functions (its naming heuristics only follow
 * declarations and variable bindings), but any function carrying the `'use memo'` opt-in
 * directive is compiled regardless of position — including inline inside an object literal.
 * For module-scope objects the property reference is already stable across renders, so the
 * directive alone captures the full memoization win, with none of the scope/closure hazards of
 * hoisting the function out.
 *
 * Edits are offset-based splices through `magic-string` (never a full reprint), so untouched
 * code stays byte-identical, TypeScript syntax passes through, and the returned sourcemap
 * composes with the bundler's own chain.
 */

import MagicString, {type SourceMap} from 'magic-string'
import type {Surface} from './surfaces.ts'
import {defaultSurfaces} from './surfaces.ts'

/**
 * The minimal structural shape of the AST nodes this transform inspects. Start/end offsets are
 * UTF-16 code-unit indexes into the source (the convention shared by `yuku-parser` and
 * `rolldown/parseAst`), so plain string splicing applies the edits safely. The index signature
 * lets the walker recurse through every child without per-node-type knowledge.
 */
type EstreeNode = {
  type: string
  start: number
  end: number
} & Record<string, unknown>

type IdentifierNode = EstreeNode & {type: 'Identifier'; name: string}

/**
 * The `Program` root of a parsed module. Structurally satisfied by the return types of both
 * `yuku-parser` and `rolldown/parseAst`, so callers never need to cast.
 * @public
 */
export interface EstreeProgram {
  type: 'Program'
  body: readonly unknown[]
}

/** Options for {@link annotateReactCompilerSurfaces}. @public */
export interface AnnotateOptions {
  /**
   * The module's file path, used to pick the parser dialect (`.ts`/`.tsx`/`.jsx`) and recorded
   * as the sourcemap source.
   */
  filename?: string
  /**
   * The surfaces to annotate.
   * @defaultValue `defaultSurfaces`
   */
  surfaces?: readonly Surface[]
}

/** The result of a source-changing {@link annotateReactCompilerSurfaces} run. @public */
export interface AnnotateResult {
  /** The annotated source. */
  code: string
  /** A high-resolution sourcemap for the splices, composable with the bundler's own chain. */
  map: SourceMap
  /** How many functions received a `'use memo'` directive. */
  annotated: number
}

/**
 * The directives `babel-plugin-react-compiler` understands. A function that already carries
 * one of these (or a dynamic `use memo if(…)` gate) made its own choice — never override it.
 */
const compilerDirectives = new Set(['use memo', 'use no memo', 'use forget', 'use no forget'])
const dynamicGatingDirective = /^use memo if\(/

const hookNamePattern = /^use[A-Z0-9]/

function isEstreeNode(value: unknown): value is EstreeNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as {type?: unknown}).type === 'string'
  )
}

function isIdentifier(value: unknown): value is IdentifierNode {
  return isEstreeNode(value) && value.type === 'Identifier'
}

function childNode(node: EstreeNode, key: string): EstreeNode | undefined {
  const value = node[key]
  return isEstreeNode(value) ? value : undefined
}

function childNodes(node: EstreeNode, key: string): EstreeNode[] {
  const value = node[key]
  if (!Array.isArray(value)) return []
  return (value as unknown[]).filter(isEstreeNode)
}

/**
 * Unwraps the TypeScript/grouping wrappers that don't change what an expression is:
 * parentheses, `as`/`satisfies` casts, and non-null assertions.
 */
function unwrapExpression(node: EstreeNode): EstreeNode {
  let current = node
  for (;;) {
    if (
      current.type === 'ParenthesizedExpression' ||
      current.type === 'TSAsExpression' ||
      current.type === 'TSSatisfiesExpression' ||
      current.type === 'TSNonNullExpression'
    ) {
      const inner = childNode(current, 'expression')
      if (!inner) return current
      current = inner
      continue
    }
    return current
  }
}

function isFunctionExpressionNode(node: EstreeNode): boolean {
  return node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression'
}

/** Node types that introduce a new function scope (anchors only match outside all of them). */
const functionScopeTypes = new Set([
  'ArrowFunctionExpression',
  'FunctionExpression',
  'FunctionDeclaration',
])

/** A compiled path pattern: a leading `**.` turns exact matching into suffix matching. */
interface PathPattern {
  suffix: boolean
  segments: readonly string[]
}

function compilePathPattern(pattern: string): PathPattern {
  const segments = pattern.split('.')
  if (segments[0] === '**') return {suffix: true, segments: segments.slice(1)}
  return {suffix: false, segments}
}

function matchesPatterns(patterns: readonly PathPattern[], path: readonly string[]): boolean {
  for (const {suffix, segments} of patterns) {
    if (suffix) {
      if (path.length < segments.length) continue
      const offset = path.length - segments.length
      if (segments.every((segment, index) => segment === '*' || segment === path[offset + index]))
        return true
    } else {
      if (path.length !== segments.length) continue
      if (segments.every((segment, index) => segment === '*' || segment === path[index]))
        return true
    }
  }
  return false
}

/** A {@link Surface} with its path patterns pre-compiled. */
interface CompiledSurface {
  surface: Surface
  patterns: readonly PathPattern[]
}

/**
 * The import-resolution tables built from the module's import declarations:
 * - `callees`: local binding name → surfaces anchored by calls to it
 * - `namespaces`: namespace binding name → import source (for `ns.defineConfig(…)` callees,
 *   only for sources some surface actually anchors on)
 * - `types`: local type name → surfaces anchored by annotations with it
 */
interface ImportTables {
  surfaces: readonly CompiledSurface[]
  callees: Map<string, CompiledSurface[]>
  namespaces: Map<string, string>
  types: Map<string, CompiledSurface[]>
}

function buildImportTables(
  program: EstreeProgram,
  surfaces: readonly CompiledSurface[],
): ImportTables {
  const tables: ImportTables = {
    surfaces,
    callees: new Map(),
    namespaces: new Map(),
    types: new Map(),
  }
  const calleeSources = new Set(
    surfaces.flatMap((compiled) => compiled.surface.callees?.sources ?? []),
  )

  for (const statement of program.body) {
    if (!isEstreeNode(statement) || statement.type !== 'ImportDeclaration') continue
    const source = childNode(statement, 'source')
    const sourceValue = source?.['value']
    if (typeof sourceValue !== 'string') continue

    for (const specifier of childNodes(statement, 'specifiers')) {
      const local = childNode(specifier, 'local')
      if (!isIdentifier(local)) continue

      if (specifier.type === 'ImportNamespaceSpecifier') {
        if (calleeSources.has(sourceValue)) tables.namespaces.set(local.name, sourceValue)
        continue
      }
      if (specifier.type !== 'ImportSpecifier') continue

      // The imported name is either an identifier (`import {defineConfig}`) or a string
      // literal (`import {'defineConfig' as dc}`)
      const imported = childNode(specifier, 'imported')
      const importedLiteral = imported?.['value']
      const importedName = isIdentifier(imported)
        ? imported.name
        : typeof importedLiteral === 'string'
          ? importedLiteral
          : undefined
      if (importedName === undefined) continue

      for (const compiled of surfaces) {
        const {callees, typeAnnotations} = compiled.surface
        if (
          callees &&
          callees.names.includes(importedName) &&
          callees.sources.includes(sourceValue)
        ) {
          const entries = tables.callees.get(local.name) ?? []
          entries.push(compiled)
          tables.callees.set(local.name, entries)
        }
        if (
          typeAnnotations &&
          typeAnnotations.names.includes(importedName) &&
          typeAnnotations.sources.includes(sourceValue)
        ) {
          const entries = tables.types.get(local.name) ?? []
          entries.push(compiled)
          tables.types.set(local.name, entries)
        }
      }
    }
  }

  return tables
}

/** Resolves the surfaces anchored by a call expression's callee, if any. */
function resolveCalleeSurfaces(
  callee: EstreeNode,
  tables: ImportTables,
): CompiledSurface[] | undefined {
  if (isIdentifier(callee)) {
    return tables.callees.get(callee.name)
  }
  if (callee.type === 'MemberExpression' && callee['computed'] !== true) {
    const object = childNode(callee, 'object')
    const property = childNode(callee, 'property')
    if (!isIdentifier(object) || !isIdentifier(property)) return undefined
    const source = tables.namespaces.get(object.name)
    if (source === undefined) return undefined
    // Re-resolve the member name against the namespace's import source
    const matches = tables.surfaces.filter(({surface: {callees}}) => {
      return callees && callees.names.includes(property.name) && callees.sources.includes(source)
    })
    return matches.length > 0 ? matches : undefined
  }
  return undefined
}

/** The type name of a `TSTypeReference`, when it is a plain (unqualified) identifier. */
function typeReferenceName(node: EstreeNode | undefined): string | undefined {
  if (!node || node.type !== 'TSTypeReference') return undefined
  const typeName = childNode(node, 'typeName')
  return isIdentifier(typeName) ? typeName.name : undefined
}

/** The property key as a path segment: a non-computed identifier or a string literal. */
function propertyKeyName(property: EstreeNode): string | undefined {
  if (property['computed'] === true) return undefined
  const key = childNode(property, 'key')
  if (isIdentifier(key)) return key.name
  const literal = key?.type === 'Literal' ? key['value'] : undefined
  return typeof literal === 'string' ? literal : undefined
}

interface WalkState {
  source: string
  magic: MagicString
  /** Function-node start offsets that were already annotated (or considered), for dedupe. */
  seen: Set<number>
  annotated: number
}

/**
 * Whether a block-bodied function already carries a compiler directive (opt-in, opt-out, or a
 * dynamic gate) in its directive prologue.
 */
function hasCompilerDirective(block: EstreeNode): boolean {
  for (const statement of childNodes(block, 'body')) {
    const directive = statement['directive']
    if (statement.type !== 'ExpressionStatement' || typeof directive !== 'string') break
    if (compilerDirectives.has(directive) || dynamicGatingDirective.test(directive)) return true
  }
  return false
}

/**
 * Splices the `'use memo'` opt-in into a function-valued property:
 *
 * - block bodies get the directive prepended to their directive prologue,
 * - expression-bodied arrows are wrapped into `{'use memo';return (…);}` — the body offsets
 *   include any wrapping parentheses (the source is parsed with `preserveParens`), so the
 *   original expression text is preserved verbatim inside the `return`,
 * - object methods (`input(props) {…}`) are rewritten to function-expression properties
 *   (`input: function (props) {…}`) first, because babel parses methods as `ObjectMethod`
 *   nodes, which the compiler never visits.
 *
 * Skips functions that opted in or out themselves, and `async`/generator functions (they can
 * never be components or hooks, so a memo cache would only ever be a hazard).
 */
function annotateFunction(state: WalkState, property: EstreeNode, fn: EstreeNode): void {
  if (state.seen.has(fn.start)) return
  state.seen.add(fn.start)

  if (property['kind'] !== 'init') return
  if (fn['async'] === true || fn['generator'] === true) return

  const body = childNode(fn, 'body')
  if (!body) return

  if (body.type === 'BlockStatement') {
    if (hasCompilerDirective(body)) return
    state.magic.appendLeft(body.start + 1, `'use memo';`)
  } else {
    // Expression-bodied arrow: wrap into a block with the directive and a return
    state.magic.appendLeft(body.start, `{'use memo';return (`)
    state.magic.appendRight(body.end, `);}`)
  }

  if (property['method'] === true) {
    const key = childNode(property, 'key')
    if (key) state.magic.appendLeft(key.end, ': function ')
  }

  state.annotated++
}

/**
 * Walks a surface object's literal tree, matching function-valued properties against the
 * surface's path patterns (and hook-named props when `hookProps` is enabled). Objects and
 * arrays are descended; call expressions are descended only for `hookProps` (with path
 * matching suppressed, since plugin factories re-root their own config shapes); functions are
 * never descended (once a function is compiled, the compiler owns everything inside it).
 */
function walkSurfaceValue(
  state: WalkState,
  compiled: CompiledSurface,
  node: EstreeNode,
  path: readonly string[],
  insideCall: boolean,
): void {
  const value = unwrapExpression(node)

  if (value.type === 'ObjectExpression') {
    for (const property of childNodes(value, 'properties')) {
      if (property.type !== 'Property') continue
      const key = propertyKeyName(property)
      if (key === undefined) continue
      const rawValue = childNode(property, 'value')
      if (!rawValue) continue
      const propertyValue = unwrapExpression(rawValue)

      if (isFunctionExpressionNode(propertyValue)) {
        const pathMatch = !insideCall && matchesPatterns(compiled.patterns, [...path, key])
        const hookMatch = compiled.surface.hookProps === true && hookNamePattern.test(key)
        if (pathMatch || hookMatch) annotateFunction(state, property, propertyValue)
        continue
      }
      walkSurfaceValue(state, compiled, propertyValue, [...path, key], insideCall)
    }
    return
  }

  if (value.type === 'ArrayExpression') {
    // Array elements are transparent: they consume no path segment
    for (const element of childNodes(value, 'elements')) {
      if (element.type === 'SpreadElement') continue
      walkSurfaceValue(state, compiled, element, path, insideCall)
    }
    return
  }

  if (value.type === 'CallExpression' && compiled.surface.hookProps === true) {
    for (const argument of childNodes(value, 'arguments')) {
      walkSurfaceValue(state, compiled, argument, path, true)
    }
  }
}

/**
 * Collects the object literals a callee anchor's first argument roots: the argument itself
 * (object or array of objects), or — for factory arguments like `definePlugin((opts) => ({…}))`
 * — the object literals returned by the factory (from an expression body, or from `return`
 * statements in its own body, not in nested functions).
 */
function collectAnchorObjects(argument: EstreeNode): EstreeNode[] {
  const value = unwrapExpression(argument)
  if (value.type === 'ObjectExpression' || value.type === 'ArrayExpression') return [value]

  if (isFunctionExpressionNode(value)) {
    const body = childNode(value, 'body')
    if (!body) return []
    if (body.type !== 'BlockStatement') {
      const returned = unwrapExpression(body)
      return returned.type === 'ObjectExpression' || returned.type === 'ArrayExpression'
        ? [returned]
        : []
    }
    const objects: EstreeNode[] = []
    collectReturnedObjects(body, objects)
    return objects
  }

  return []
}

function collectReturnedObjects(node: EstreeNode, objects: EstreeNode[]): void {
  if (node.type === 'ReturnStatement') {
    const argument = childNode(node, 'argument')
    if (argument) {
      const value = unwrapExpression(argument)
      if (value.type === 'ObjectExpression' || value.type === 'ArrayExpression') {
        objects.push(value)
      }
    }
    return
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value as unknown[]) {
        if (isEstreeNode(item) && !functionScopeTypes.has(item.type)) {
          collectReturnedObjects(item, objects)
        }
      }
    } else if (isEstreeNode(value) && !functionScopeTypes.has(value.type)) {
      collectReturnedObjects(value, objects)
    }
  }
}

/**
 * The main walk: callee anchors are matched at module scope only (`fnDepth === 0` — the
 * factory look-through in {@link collectAnchorObjects} is the deliberate exception), while
 * type-annotation anchors match at any scope (an annotated object inside a non-compiled
 * component still benefits, and inside a compiled one the extra directive is inert).
 */
function walkModule(
  state: WalkState,
  tables: ImportTables,
  node: EstreeNode,
  fnDepth: number,
): void {
  if (node.type === 'CallExpression' && fnDepth === 0) {
    const callee = childNode(node, 'callee')
    const surfaces = callee ? resolveCalleeSurfaces(callee, tables) : undefined
    if (surfaces) {
      const [argument] = childNodes(node, 'arguments')
      if (argument) {
        for (const compiled of surfaces) {
          for (const object of collectAnchorObjects(argument)) {
            walkSurfaceValue(state, compiled, object, [], false)
          }
        }
      }
    }
  } else if (node.type === 'VariableDeclarator') {
    // `const components: PortableTextComponents = {…}`
    const id = childNode(node, 'id')
    const annotation = id && childNode(id, 'typeAnnotation')
    const typeName = annotation && typeReferenceName(childNode(annotation, 'typeAnnotation'))
    const surfaces = typeName === undefined ? undefined : tables.types.get(typeName)
    const init = childNode(node, 'init')
    if (surfaces && init) {
      for (const compiled of surfaces) {
        walkSurfaceValue(state, compiled, init, [], false)
      }
    }
  } else if (node.type === 'TSSatisfiesExpression' || node.type === 'TSAsExpression') {
    // `{…} satisfies PortableTextComponents` / `{…} as PortableTextComponents`
    const typeName = typeReferenceName(childNode(node, 'typeAnnotation'))
    const surfaces = typeName === undefined ? undefined : tables.types.get(typeName)
    const expression = childNode(node, 'expression')
    if (surfaces && expression) {
      for (const compiled of surfaces) {
        walkSurfaceValue(state, compiled, expression, [], false)
      }
    }
  }

  const childDepth = functionScopeTypes.has(node.type) ? fnDepth + 1 : fnDepth
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value as unknown[]) {
        if (isEstreeNode(item)) walkModule(state, tables, item, childDepth)
      }
    } else if (isEstreeNode(value)) {
      walkModule(state, tables, value, childDepth)
    }
  }
}

/** Whether the module opted out of the compiler entirely with a top-level directive. */
function hasModuleOptOut(program: EstreeProgram): boolean {
  for (const statement of program.body) {
    if (!isEstreeNode(statement)) continue
    const directive = statement['directive']
    if (statement.type !== 'ExpressionStatement' || typeof directive !== 'string') break
    if (directive === 'use no memo' || directive === 'use no forget') return true
  }
  return false
}

/** The parser `lang` for a module id, mirroring how the file would be loaded by the bundler. */
function langFromPath(filePath: string | undefined): 'js' | 'jsx' | 'ts' | 'tsx' {
  if (filePath === undefined) return 'tsx'
  if (filePath.endsWith('.tsx')) return 'tsx'
  if (filePath.endsWith('.mts') || filePath.endsWith('.cts') || filePath.endsWith('.ts'))
    return 'ts'
  if (filePath.endsWith('.jsx')) return 'jsx'
  return 'js'
}

/** Every token whose presence a module needs before parsing could possibly find an anchor. */
function anchorTokens(surfaces: readonly Surface[]): string[] {
  const tokens = new Set<string>()
  for (const surface of surfaces) {
    for (const name of surface.callees?.names ?? []) tokens.add(name)
    for (const name of surface.typeAnnotations?.names ?? []) tokens.add(name)
  }
  return [...tokens]
}

/**
 * Injects `'use memo'` React Compiler opt-in directives into the function-valued properties of
 * allow-listed Sanity API surface objects (see {@link defaultSurfaces}), so a downstream
 * `babel-plugin-react-compiler` pass memoizes them. Returns `null` when the module needs no
 * changes (no anchors, everything already annotated, or a module-level `'use no memo'`).
 *
 * The parser is lazy-loaded so its native binding only loads once a module actually contains
 * an anchor token.
 * @public
 */
export async function annotateReactCompilerSurfaces(
  source: string,
  options: AnnotateOptions = {},
): Promise<AnnotateResult | null> {
  const surfaces = options.surfaces ?? defaultSurfaces

  // Cheap pre-parse bail: no anchor token in the source means no anchor can match
  if (!anchorTokens(surfaces).some((token) => source.includes(token))) return null

  const {parse} = await import('yuku-parser')
  // `preserveParens: true` so expression-arrow bodies keep their wrapping parentheses in the
  // reported offsets — the block-wrapping splice must produce `return (…)`, never a bare
  // `return {…}` that would re-parse an object-literal body as a block statement. yuku is
  // error-tolerant (it always produces an AST), so syntactically broken sources pass through
  // best-effort here and fail in the bundler's own parse with its proper diagnostics.
  const {program} = parse(source, {lang: langFromPath(options.filename), preserveParens: true})

  if (hasModuleOptOut(program)) return null

  const compiled: CompiledSurface[] = surfaces.map((surface) => ({
    surface,
    patterns: (surface.paths ?? []).map(compilePathPattern),
  }))

  const tables = buildImportTables(program, compiled)
  if (tables.callees.size === 0 && tables.namespaces.size === 0 && tables.types.size === 0) {
    return null
  }

  const state: WalkState = {
    source,
    magic: new MagicString(source),
    seen: new Set(),
    annotated: 0,
  }

  for (const statement of program.body) {
    if (isEstreeNode(statement)) walkModule(state, tables, statement, 0)
  }

  if (state.annotated === 0) return null

  return {
    code: state.magic.toString(),
    map: state.magic.generateMap({hires: 'boundary', source: options.filename}),
    annotated: state.annotated,
  }
}
