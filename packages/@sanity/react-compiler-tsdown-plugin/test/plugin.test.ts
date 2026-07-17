import {describe, expect, test} from 'vitest'
import {reactCompilerSurfacesPlugin} from '../src/index.ts'

describe('reactCompilerSurfacesPlugin', () => {
  test('wraps the rolldown plugin for tsdown', async () => {
    const plugin = reactCompilerSurfacesPlugin()
    expect(plugin).toMatchObject({name: 'sanity-react-compiler-surfaces'})

    // The transform hook (with its id/code filters) is carried over from the rolldown plugin
    const transform = (plugin as {transform?: {filter?: unknown; handler?: unknown}}).transform
    expect(transform?.filter).toBeDefined()
    expect(transform?.handler).toBeInstanceOf(Function)
  })

  test('the transform annotates surface modules', async () => {
    const plugin = reactCompilerSurfacesPlugin() as {
      transform: {
        handler: (this: unknown, code: string, id: string) => Promise<{code: string} | undefined>
      }
    }
    const source = `
import {defineType} from 'sanity'

export const myType = defineType({
  name: 'myType',
  type: 'string',
  components: {input: (props) => props.renderDefault(props)},
})
`
    const result = await plugin.transform.handler.call(undefined, source, '/src/schema.ts')
    expect(result?.code).toContain(`'use memo'`)

    const untouched = await plugin.transform.handler.call(
      undefined,
      `export const foo = 1`,
      '/src/foo.ts',
    )
    expect(untouched).toBeUndefined()
  })
})
