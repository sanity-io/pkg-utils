import type {DocumentNode} from './index.ts'

export type {DocumentNode} from './index.ts'

export interface FieldNode {
  type: 'field'
  name: string
  parent: DocumentNode
}
