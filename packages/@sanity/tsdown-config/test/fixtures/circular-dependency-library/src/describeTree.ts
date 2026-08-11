// The cycle is the point of this fixture: `checks.circularDependency` must keep warning about
// runtime cycles while the declaration-only ones are suppressed
// oxlint-disable-next-line import/no-cycle
import {describeField} from './describeField.ts'
import type {DocumentNode} from './exports/index.ts'

/**
 * Half of a genuine *runtime* import cycle (`describeTree` ↔ `describeField`), which must keep
 * warning: values imported in a cycle can be uninitialized at module evaluation time.
 */
export function describeTree(node: DocumentNode): string {
  return `${node.type}(${node.fields.map(describeField).join(', ')})`
}
