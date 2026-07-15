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

function stringifyExports(
  functionSerializationImports: Set<string>,
  value: unknown,
  unusedCompositionRegex: RegExp | null,
  key: string,
  exportLookup: Map<unknown, string>,
  exportDependencyGraph: DependencyGraph,
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
        return next(unusedCompositionRegex ? node.replace(unusedCompositionRegex, '') : node)
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

          if (typeof importPath !== 'string' || typeof importName !== 'string' || !Array.isArray(args)) {
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
 * into an ES module.
 * @public
 */
export function serializeVanillaModule(
  cssImports: Array<string>,
  exports: Record<string, unknown>,
  unusedCompositionRegex: RegExp | null,
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
