/**
 * A minimal stand-in for the `sanity` module: the fixtures only need the literal `sanity`
 * import specifier (the surface anchor) and typed identity functions — not the real Studio.
 * The rolldown build tests mark `sanity` external, the Vite test aliases it here, and the
 * package tsconfig maps the specifier here through `paths`.
 */
import type {ReactNode} from 'react'

export interface StubInputProps {
  schemaType?: {name?: string}
  value?: unknown
  renderDefault: (props: StubInputProps) => ReactNode
}

export interface StubSchemaTypeDefinition {
  name: string
  type: string
  components?: {input?: (props: StubInputProps) => ReactNode}
}

export interface StubConfig {
  name: string
  form: {components: {input: (props: StubInputProps) => ReactNode}}
}

export function defineType(schema: StubSchemaTypeDefinition): StubSchemaTypeDefinition {
  return schema
}

export function defineConfig(config: StubConfig): StubConfig {
  return config
}
