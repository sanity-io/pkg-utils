/**
 * A minimal stand-in for the `sanity` module: the fixture only needs the literal `sanity`
 * import specifier (the surface anchor) and a `defineConfig` identity function — not the real
 * Studio. The test's Vite config aliases `sanity` here, and the package tsconfig maps the
 * specifier here through `paths`.
 */
import type {ReactNode} from 'react'

export interface StubInputProps {
  schemaType?: {name?: string}
  value?: unknown
  renderDefault: (props: StubInputProps) => ReactNode
}

export interface StubConfig {
  name: string
  form: {components: {input: (props: StubInputProps) => ReactNode}}
}

export function defineConfig(config: StubConfig): StubConfig {
  return config
}
