/**
 * Ported from `@vanilla-extract/integration` (MIT licensed, Copyright (c) 2021 SEEK), with the
 * `dedent` dependency replaced by a plain string and the untyped property probing rewritten as
 * type guards.
 */
import {stringify} from 'javascript-stringify'
import {hash} from './hash.ts'

function isRecord(value: unknown): value is Record<string | symbol, unknown> {
  return typeof value === 'object' && value !== null
}

// Copied from https://github.com/you-dont-need/You-Dont-Need-Lodash-Underscore/blob/51f83bd3db728fd7ee177de1ffc253fdb99c537f/README.md#_isplainobject
function isPlainObject(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }

  if (Object.prototype.toString.call(value) !== '[object Object]') {
    return false
  }

  const prototype: unknown = Object.getPrototypeOf(value)
  if (prototype === null) {
    return true
  }

  const constructor =
    isRecord(prototype) && Object.prototype.hasOwnProperty.call(prototype, 'constructor')
      ? prototype['constructor']
      : undefined

  return (
    typeof constructor === 'function' &&
    constructor instanceof constructor &&
    Function.prototype.call(constructor) === Function.prototype.call(value)
  )
}

/**
 * The atomic pass's result the serializer needs to expand exported class lists, see
 * {@link serializeVanillaModule}.
 * @public
 */
export interface ClassListExpansions {
  /** Every class name registered by the evaluated modules, to recognize class list strings. */
  localClassNames: ReadonlySet<string>
  /** Identity class → the atomic classes its declarations were split into. */
  expansions: ReadonlyMap<string, ReadonlyArray<string>>
}

/**
 * Appends the atomic classes of every identity class in a class list string, keeping each
 * identity class in place and first before its own atomics: `'a1'` → `'a1 x1 x2'`,
 * `'c1 a1'` → `'c1 x3 a1 x1 x2'`. Strings that aren't pure class lists (a token that isn't a
 * registered class, e.g. an exported selector string) are left untouched.
 */
function expandClassList(
  value: string,
  {localClassNames, expansions}: ClassListExpansions,
): string {
  if (value === '') return value
  const tokens = value.split(' ')
  if (!tokens.every((token) => localClassNames.has(token))) return value

  const result: string[] = []
  const seen = new Set<string>()
  for (const token of tokens) {
    if (seen.has(token)) continue
    seen.add(token)
    result.push(token)
    for (const atomicClass of expansions.get(token) ?? []) {
      if (seen.has(atomicClass)) continue
      seen.add(atomicClass)
      result.push(atomicClass)
    }
  }
  return result.join(' ')
}

function stringifyExports(
  functionSerializationImports: Set<string>,
  value: unknown,
  unusedCompositionRegex: RegExp | null,
  key: string,
  exportLookup: Map<unknown, string>,
  exportDependencyGraph: DependencyGraph,
  classListExpansions: ClassListExpansions | undefined,
): string | undefined {
  return stringify(
    value,
    (node: unknown, _indent, next) => {
      const valueType = typeof node
      if (
        valueType === 'boolean' ||
        valueType === 'number' ||
        valueType === 'undefined' ||
        node === null
      ) {
        return next(node)
      }

      if (Array.isArray(node) || isPlainObject(node)) {
        const reusedExport = exportLookup.get(node)

        if (reusedExport && reusedExport !== key) {
          exportDependencyGraph.addDependency(key, reusedExport)
          return reusedExport
        }
        return next(node)
      }

      if (isRecord(node) && Symbol.toStringTag in node) {
        const {[Symbol.toStringTag]: _tag, ...valueWithoutTag} = node
        return next(valueWithoutTag)
      }

      if (typeof node === 'string') {
        const stripped = unusedCompositionRegex ? node.replace(unusedCompositionRegex, '') : node
        return next(classListExpansions ? expandClassList(stripped, classListExpansions) : stripped)
      }

      if (typeof node === 'function') {
        const serializationParams: unknown =
          Reflect.get(node, '__function_serializer__') || Reflect.get(node, '__recipe__')

        if (serializationParams !== undefined && serializationParams !== null) {
          if (!isRecord(serializationParams)) {
            throw new Error('Invalid function serialization params')
          }

          const importPath = serializationParams['importPath']
          const importName = serializationParams['importName']
          const args = serializationParams['args']

          if (
            typeof importPath !== 'string' ||
            typeof importName !== 'string' ||
            !Array.isArray(args)
          ) {
            throw new Error('Invalid function serialization params')
          }

          try {
            const hashedImportName = `_${hash(`${importName}${importPath}`).slice(0, 5)}`

            functionSerializationImports.add(
              `import { ${importName} as ${hashedImportName} } from '${importPath}';`,
            )

            return `${hashedImportName}(${args
              .map((arg: unknown) =>
                stringifyExports(
                  functionSerializationImports,
                  arg,
                  unusedCompositionRegex,
                  key,
                  exportLookup,
                  exportDependencyGraph,
                  classListExpansions,
                ),
              )
              .join(',')})`
          } catch (err) {
            console.error(err)
            throw new Error('Invalid function serialization params', {cause: err})
          }
        }
      }

      throw new Error(
        [
          'Invalid exports.',
          '',
          'You can only export plain objects, arrays, strings, numbers and null/undefined.',
        ].join('\n'),
      )
    },
    0,
    {
      references: true, // Allow circular references
      maxDepth: Infinity,
      maxValues: Infinity,
    },
  )
}

const defaultExportName = '__default__'

class DependencyGraph {
  private graph = new Map<string, Set<string>>()

  /**
   * Creates a "depends on" relationship between `key` and `dependency`
   */
  addDependency(key: string, dependency: string): void {
    const dependencies = this.graph.get(key)

    if (dependencies) {
      dependencies.add(dependency)
    } else {
      this.graph.set(key, new Set([dependency]))
    }
  }

  /**
   * Whether or not `key` depends on `dependency`
   */
  dependsOn(key: string, dependency: string): boolean {
    const dependencies = this.graph.get(key)

    if (dependencies) {
      if (dependencies.has(dependency)) {
        return true
      }

      for (const dep of dependencies) {
        if (this.dependsOn(dep, dependency)) {
          return true
        }
      }
    }

    return false
  }
}

/**
 * Serializes the evaluated exports of a `.css.ts` module (plus its virtual CSS imports) back
 * into an ES module. With `classListExpansions` (the atomic pass's result), every exported
 * class list gains the atomic classes of the identity classes it contains — the same classlist
 * shape as vanilla-extract's own style composition, identity class first.
 * @public
 */
export function serializeVanillaModule(
  cssImports: Array<string>,
  exports: Record<string, unknown>,
  unusedCompositionRegex: RegExp | null,
  classListExpansions?: ClassListExpansions,
): string {
  const functionSerializationImports = new Set<string>()
  const exportLookup = new Map(
    Object.entries(exports).map(([key, value]) => [
      value,
      key === 'default' ? defaultExportName : key,
    ]),
  )
  const exportDependencyGraph = new DependencyGraph()

  const moduleExports = Object.entries(exports).map(([key, value]): [string, string] => {
    const serializedExport = stringifyExports(
      functionSerializationImports,
      value,
      unusedCompositionRegex,
      key === 'default' ? defaultExportName : key,
      exportLookup,
      exportDependencyGraph,
      classListExpansions,
    )

    if (key === 'default') {
      return [
        defaultExportName,
        [
          `var ${defaultExportName} = ${serializedExport};`,
          `export default ${defaultExportName};`,
        ].join('\n'),
      ]
    }

    return [key, `export var ${key} = ${serializedExport};`]
  })

  const sortedModuleExports = moduleExports
    .toSorted(([key1], [key2]) => {
      if (exportDependencyGraph.dependsOn(key1, key2)) {
        return 1
      }

      if (exportDependencyGraph.dependsOn(key2, key1)) {
        return -1
      }

      return 0
    })
    .map(([, s]) => s)

  const outputCode = [...cssImports, ...functionSerializationImports, ...sortedModuleExports]

  return outputCode.join('\n')
}
