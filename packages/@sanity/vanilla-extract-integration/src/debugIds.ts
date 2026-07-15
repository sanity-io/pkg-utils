/**
 * A port of `@vanilla-extract/babel-plugin-debug-ids` (MIT licensed, Copyright (c) 2021 SEEK)
 * off babel and onto the oxc-shaped TS-ESTree AST (as produced by `rolldown/parseAst`, and
 * matched exactly by `yuku-parser`): one recursive walk with an ancestor stack replaces babel's
 * visitor/`findParent` machinery, and the debug IDs are spliced into the source as offset-based
 * insertions instead of a full AST reprint — so output stays byte-identical outside the touched
 * calls, and TypeScript syntax passes through untouched.
 *
 * The only upstream behavior intentionally dropped is the special-casing of babel-compiled
 * `createTheme` destructures (`_slicedToArray` shapes): they cannot occur in authored source,
 * which is all this transform ever sees.
 */

const packageIdentifiers = new Set(['@vanilla-extract/css', '@vanilla-extract/recipes'])

/**
 * The minimal structural shape of the AST nodes this transform inspects. Start/end offsets are
 * UTF-16 code-unit indexes into the source (the convention shared by `rolldown/parseAst` and
 * `yuku-parser`), so plain string slicing applies the insertions safely. The index signature
 * lets the walker recurse through every child without per-node-type knowledge.
 */
type EstreeNode = {
  type: string
  start: number
  end: number
} & Record<string, unknown>

type IdentifierNode = EstreeNode & {
  type: 'Identifier'
  name: string
}

type CallExpressionNode = EstreeNode & {
  type: 'CallExpression'
  callee: EstreeNode
  arguments: EstreeNode[]
}

/**
 * The `Program` root of a parsed module. Structurally satisfied by the return types of both
 * `rolldown/parseAst` and `yuku-parser`, so callers never need to cast.
 */
export interface EstreeProgram {
  type: 'Program'
  body: readonly unknown[]
}

interface DebugConfig {
  maxParams: number
  hasDebugId?: (node: CallExpressionNode) => boolean
}

function isEstreeNode(value: unknown): value is EstreeNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as {type?: unknown}).type === 'string'
  )
}

function isIdentifier(value: unknown, name?: string): value is IdentifierNode {
  return (
    isEstreeNode(value) &&
    value.type === 'Identifier' &&
    (name === undefined || value['name'] === name)
  )
}

function isCallExpression(node: EstreeNode): node is CallExpressionNode {
  return node.type === 'CallExpression'
}

function isStringOrTemplateLiteral(node: EstreeNode | undefined): boolean {
  if (!node) return false
  if (node.type === 'TemplateLiteral') return true
  return node.type === 'Literal' && typeof node['value'] === 'string'
}

const lastArgIsDebugId = ({arguments: args}: CallExpressionNode): boolean =>
  isStringOrTemplateLiteral(args[args.length - 1])

const debuggableFunctionConfig: Record<string, DebugConfig> = {
  style: {maxParams: 2},
  createTheme: {maxParams: 3},
  styleVariants: {maxParams: 3, hasDebugId: lastArgIsDebugId},
  fontFace: {maxParams: 2},
  keyframes: {maxParams: 2},
  createVar: {maxParams: 2, hasDebugId: lastArgIsDebugId},
  recipe: {maxParams: 2},
  createContainer: {maxParams: 1},
  createViewTransition: {maxParams: 1},
  layer: {maxParams: 2, hasDebugId: lastArgIsDebugId},
}

const styleFunctions = [
  ...Object.keys(debuggableFunctionConfig),
  'globalStyle',
  'createGlobalTheme',
  'createThemeContract',
  'globalFontFace',
  'globalKeyframes',
  'globalLayer',
  'recipe',
]

function extractName(node: EstreeNode): string | undefined {
  switch (node.type) {
    case 'Property': {
      const key = node['key']
      return isIdentifier(key) ? key.name : undefined
    }
    case 'FunctionDeclaration': {
      const id = node['id']
      return isIdentifier(id) ? id.name : undefined
    }
    case 'VariableDeclarator': {
      const id = node['id']
      if (isIdentifier(id)) return id.name
      if (isEstreeNode(id) && id.type === 'ArrayPattern') {
        const elements = id['elements']
        const firstElement = Array.isArray(elements) ? (elements[0] as unknown) : undefined
        if (isIdentifier(firstElement)) return firstElement.name
      }
      return undefined
    }
    case 'AssignmentExpression': {
      const left = node['left']
      return isIdentifier(left) ? left.name : undefined
    }
    case 'ExportDefaultDeclaration':
      return 'default'
    default:
      return undefined
  }
}

/**
 * The contexts in which the debug name is joined from every named ancestor (object keys, array
 * positions, function returns) instead of taken from the nearest named parent alone.
 */
const nameJoiningParents = new Set([
  'Property',
  'ReturnStatement',
  'ArrowFunctionExpression',
  'ArrayExpression',
  'SpreadElement',
])

/**
 * Ports babel's `getDebugId`: find the first ancestor that isn't a call/sequence expression,
 * then either join the names of every ancestor (for object/array/arrow/return/spread contexts)
 * or extract the name of that ancestor directly. `ancestors` is ordered root-first and excludes
 * the call node itself (and the `Program` root, which never contributes a name).
 */
function getDebugId(ancestors: readonly EstreeNode[]): string | undefined {
  let firstRelevantParent: EstreeNode | undefined
  for (let index = ancestors.length - 1; index >= 0; index--) {
    const ancestor = ancestors[index]
    if (!ancestor) continue
    if (ancestor.type !== 'CallExpression' && ancestor.type !== 'SequenceExpression') {
      firstRelevantParent = ancestor
      break
    }
  }

  if (!firstRelevantParent) {
    return undefined
  }

  if (nameJoiningParents.has(firstRelevantParent.type)) {
    const names: string[] = []
    for (const ancestor of ancestors) {
      const name = extractName(ancestor)
      if (name) {
        names.push(name)
      }
    }
    return names.join('_')
  }

  return extractName(firstRelevantParent)
}

function getRelevantCall(
  node: CallExpressionNode,
  namespaceImport: string,
  importIdentifiers: ReadonlyMap<string, string>,
): string | undefined {
  const {callee} = node

  if (namespaceImport && callee.type === 'MemberExpression') {
    const property = callee['property']
    if (isIdentifier(callee['object'], namespaceImport)) {
      return styleFunctions.find((exportName) => isIdentifier(property, exportName))
    }
    return undefined
  }

  for (const [identifier, styleFunction] of importIdentifiers) {
    if (isIdentifier(callee, identifier)) {
      return styleFunction
    }
  }
  return undefined
}

interface Insertion {
  offset: number
  text: string
}

interface WalkState {
  namespaceImport: string
  importIdentifiers: Map<string, string>
  insertions: Insertion[]
}

function visitImportDeclaration(node: EstreeNode, state: WalkState): void {
  const source = node['source']
  const sourceValue = isEstreeNode(source) ? source['value'] : undefined
  if (typeof sourceValue !== 'string' || !packageIdentifiers.has(sourceValue)) {
    return
  }

  const specifiers = node['specifiers']
  if (!Array.isArray(specifiers)) return

  for (const specifier of specifiers as unknown[]) {
    if (!isEstreeNode(specifier)) continue

    if (specifier.type === 'ImportNamespaceSpecifier') {
      const local = specifier['local']
      if (isIdentifier(local)) {
        state.namespaceImport = local.name
      }
    } else if (specifier.type === 'ImportSpecifier') {
      const imported = specifier['imported']
      const local = specifier['local']
      // The imported name is either an identifier (`import {style}`) or a string literal
      // (`import {'style' as s}`)
      const literalValue = isEstreeNode(imported) ? imported['value'] : undefined
      const importName = isIdentifier(imported)
        ? imported.name
        : typeof literalValue === 'string'
          ? literalValue
          : ''

      if (styleFunctions.includes(importName) && isIdentifier(local)) {
        state.importIdentifiers.set(local.name, importName)
      }
    }
  }
}

function visitCallExpression(
  node: CallExpressionNode,
  ancestors: readonly EstreeNode[],
  state: WalkState,
): void {
  const usedExport = getRelevantCall(node, state.namespaceImport, state.importIdentifiers)

  if (!usedExport || !(usedExport in debuggableFunctionConfig)) {
    return
  }

  const config = debuggableFunctionConfig[usedExport]
  if (!config) return
  const {maxParams, hasDebugId} = config

  if (node.arguments.length >= maxParams || hasDebugId?.(node)) {
    return
  }

  const debugIdent = getDebugId(ancestors)
  if (!debugIdent) {
    return
  }

  const lastArgument = node.arguments[node.arguments.length - 1]
  if (lastArgument) {
    // Inserting right after the last argument keeps a trailing comma (if any) trailing
    state.insertions.push({offset: lastArgument.end, text: `, ${JSON.stringify(debugIdent)}`})
  } else {
    // No arguments: insert before the closing paren
    state.insertions.push({offset: node.end - 1, text: JSON.stringify(debugIdent)})
  }
}

function walk(node: EstreeNode, ancestors: EstreeNode[], state: WalkState): void {
  if (node.type === 'ImportDeclaration') {
    visitImportDeclaration(node, state)
  } else if (isCallExpression(node)) {
    visitCallExpression(node, ancestors, state)
  }

  ancestors.push(node)
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value as unknown[]) {
        if (isEstreeNode(item)) {
          walk(item, ancestors, state)
        }
      }
    } else if (isEstreeNode(value)) {
      walk(value, ancestors, state)
    }
  }
  ancestors.pop()
}

/**
 * Injects vanilla-extract debug IDs into `source`, guided by its parsed `program`. The program
 * may come from any parser producing the oxc-shaped TS-ESTree AST with UTF-16 offsets
 * (`rolldown/parseAst`, `yuku-parser`); the source is returned unchanged when there is nothing
 * to inject.
 * @internal
 */
export function injectDebugIds(source: string, program: EstreeProgram): string {
  const state: WalkState = {
    namespaceImport: '',
    importIdentifiers: new Map(),
    insertions: [],
  }

  // Babel's parent chain includes the `Program` root, but it can never contribute a debug name
  // (it's not named, and not a call/sequence expression), so the ancestor stack omits it
  const ancestors: EstreeNode[] = []
  for (const statement of program.body) {
    if (isEstreeNode(statement)) {
      walk(statement, ancestors, state)
    }
  }

  if (state.insertions.length === 0) {
    return source
  }

  state.insertions.sort((a, b) => a.offset - b.offset)

  let result = ''
  let previousOffset = 0
  for (const {offset, text} of state.insertions) {
    result += source.slice(previousOffset, offset) + text
    previousOffset = offset
  }
  result += source.slice(previousOffset)

  return result
}
