import type {FieldNode} from './nodes.ts'

export type {FieldNode} from './nodes.ts'
export {describeTree} from '../describeTree.ts'

/**
 * Mutually recursive with {@link FieldNode}, the way public type graphs tend to be (e.g. the
 * schema definition types in `@sanity/types`). The declaration bundling pass turns the two
 * entries' `.d.ts` files into an import cycle, even though nothing about it exists at runtime.
 */
export interface DocumentNode {
  type: 'document'
  fields: FieldNode[]
}
