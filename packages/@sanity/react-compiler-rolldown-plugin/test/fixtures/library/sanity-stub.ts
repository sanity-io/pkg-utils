/**
 * A minimal stand-in for the `sanity` module: the fixture only needs the literal `sanity`
 * import specifier (the surface anchor) and a typed `defineType` identity function — not the
 * real Studio. The test build marks `sanity` external, and the package tsconfig maps the
 * specifier here through `paths`.
 */
import type {ReactNode} from 'react'

export interface StubInputProps {
  renderDefault: (props: StubInputProps) => ReactNode
}

export interface StubSchemaTypeDefinition {
  name: string
  type: string
  components?: {input?: (props: StubInputProps) => ReactNode}
}

export function defineType(schema: StubSchemaTypeDefinition): StubSchemaTypeDefinition {
  return schema
}
