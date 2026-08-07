// oxlint-disable-next-line import/no-cycle
import {describeTree} from './describeTree.ts'
import type {FieldNode} from './exports/nodes.ts'

export function describeField(node: FieldNode): string {
  return `${node.name}: ${describeTree(node.parent)}`
}
