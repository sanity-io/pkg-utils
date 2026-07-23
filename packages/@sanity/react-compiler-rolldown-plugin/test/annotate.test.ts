import {describe, expect, test} from 'vitest'
import {annotateReactCompilerSurfaces} from '../src/index.ts'

async function annotate(source: string, filename = 'sanity.config.tsx') {
  return annotateReactCompilerSurfaces(source, {filename})
}

describe('sanity-config surface', () => {
  test('annotates form.components and studio.components slots of defineConfig', async () => {
    const result = await annotate(`
import {defineConfig} from 'sanity'

export default defineConfig({
  name: 'default',
  form: {
    components: {
      input: (props) =>
        props.schemaType?.name === 'string' ? <CustomStringInput {...props} /> : props.renderDefault(props),
      field: (props) => {
        return props.renderDefault(props)
      },
    },
  },
  studio: {
    components: {
      logo: (props) => <b>{props.title}</b>,
    },
  },
})
`)
    expect(result).not.toBeNull()
    expect(result!.annotated).toBe(3)
    expect(result!.code).toMatchInlineSnapshot(`
      "
      import {defineConfig} from 'sanity'

      export default defineConfig({
        name: 'default',
        form: {
          components: {
            input: (props) =>
              {'use memo';return (props.schemaType?.name === 'string' ? <CustomStringInput {...props} /> : props.renderDefault(props));},
            field: (props) => {'use memo';
              return props.renderDefault(props)
            },
          },
        },
        studio: {
          components: {
            logo: (props) => {'use memo';return (<b>{props.title}</b>);},
          },
        },
      })
      "
    `)
  })

  test('annotates use*-named hook props, including inside plugin factory calls', async () => {
    const result = await annotate(`
import {defineConfig} from 'sanity'
import {assist} from '@sanity/assist'

export default defineConfig({
  plugins: [
    assist({
      fieldActions: {
        title: 'Custom actions',
        useFieldActions: (props) => {
          const getUserInput = useUserInput()
          return useMemo(() => [getUserInput], [getUserInput])
        },
      },
    }),
  ],
})
`)
    expect(result).not.toBeNull()
    expect(result!.annotated).toBe(1)
    expect(result!.code).toContain(`useFieldActions: (props) => {'use memo';`)
  })

  test('does not annotate slots outside the allow-list (icon, document.actions)', async () => {
    const result = await annotate(`
import {defineConfig} from 'sanity'

export default defineConfig({
  icon: () => <AvatarIcon />,
  document: {
    actions: (prev) => prev.filter(Boolean),
  },
  form: {
    unrelated: (value) => value,
  },
})
`)
    expect(result).toBeNull()
  })

  test('ignores defineConfig imported from other modules', async () => {
    const result = await annotate(`
import {defineConfig} from 'vite'

export default defineConfig({
  form: {
    components: {
      input: (props) => props.renderDefault(props),
    },
  },
})
`)
    expect(result).toBeNull()
  })

  test('follows aliased and namespace imports', async () => {
    const aliased = await annotate(`
import {defineConfig as createConfig} from 'sanity'

export default createConfig({
  form: {components: {input: (props) => props.renderDefault(props)}},
})
`)
    expect(aliased!.code).toContain(`input: (props) => {'use memo';return (`)

    const namespaced = await annotate(`
import * as sanity from 'sanity'

export default sanity.defineConfig({
  form: {components: {input: (props) => props.renderDefault(props)}},
})
`)
    expect(namespaced!.code).toContain(`input: (props) => {'use memo';return (`)
  })

  test('looks through workspace arrays and definePlugin factories', async () => {
    const workspaces = await annotate(`
import {defineConfig} from 'sanity'

export default defineConfig([
  {name: 'a', form: {components: {input: (props) => props.renderDefault(props)}}},
  {name: 'b', form: {components: {field: (props) => props.renderDefault(props)}}},
])
`)
    expect(workspaces!.annotated).toBe(2)

    const factory = await annotate(`
import {definePlugin} from 'sanity'

export const myPlugin = definePlugin((options) => ({
  name: 'my-plugin',
  form: {components: {input: (props) => props.renderDefault(props)}},
}))
`)
    expect(factory!.annotated).toBe(1)
    expect(factory!.code).toContain(`input: (props) => {'use memo';return (`)

    const factoryWithReturn = await annotate(`
import {definePlugin} from 'sanity'

export const myPlugin = definePlugin(() => {
  const name = 'my-plugin'
  return {
    name,
    form: {components: {input: (props) => props.renderDefault(props)}},
  }
})
`)
    expect(factoryWithReturn!.annotated).toBe(1)
  })

  test('only anchors module-scope calls', async () => {
    const result = await annotate(`
import {defineConfig} from 'sanity'

export function createStudioConfig() {
  return defineConfig({
    form: {components: {input: (props) => props.renderDefault(props)}},
  })
}
`)
    expect(result).toBeNull()
  })
})

describe('sanity-schema surface', () => {
  test('annotates components.* slots but never icon', async () => {
    const result = await annotate(`
import {defineType, defineField} from 'sanity'

export const myType = defineType({
  name: 'myType',
  type: 'document',
  icon: () => <AvatarIcon />,
  components: {
    input: (props) => props.renderDefault(props),
    preview: (props) => <strong>{props.title}</strong>,
  },
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      components: {
        field: (props) => props.renderDefault(props),
      },
    }),
    {
      name: 'inline',
      type: 'string',
      components: {
        input: (props) => props.renderDefault(props),
      },
    },
  ],
})
`)
    expect(result).not.toBeNull()
    expect(result!.annotated).toBe(4)
    expect(result!.code).not.toContain(`icon: () => {'use memo'`)
  })

  test('rewrites object-method slots to function-expression properties', async () => {
    const result = await annotate(`
import {defineType} from 'sanity'

export const myType = defineType({
  name: 'myType',
  type: 'string',
  components: {
    input(props) {
      return props.renderDefault(props)
    },
  },
})
`)
    expect(result!.code).toContain(`input: function (props) {'use memo';`)
  })

  test('skips async functions, generators, accessors, and computed keys', async () => {
    const result = await annotate(`
import {defineType} from 'sanity'

export const myType = defineType({
  name: 'myType',
  type: 'string',
  components: {
    input: async (props) => props.renderDefault(props),
    *field(props) {},
    get preview() {
      return null
    },
    [dynamicKey]: (props) => props.renderDefault(props),
  },
})
`)
    expect(result).toBeNull()
  })
})

describe('portabletext surface', () => {
  test('annotates typed component maps (annotation, satisfies, as)', async () => {
    const annotation = await annotate(`
import type {PortableTextComponents} from '@portabletext/react'

export const components: PortableTextComponents = {
  hardBreak: () => <br />,
  types: {
    image: ({value}) => <img src={value.imageUrl} />,
  },
  marks: {
    link: ({children, value}) => {
      const rel = !value.href.startsWith('/') ? 'noreferrer noopener' : undefined
      return (
        <a href={value.href} rel={rel}>
          {children}
        </a>
      )
    },
    'strike-through': ({children}) => <s>{children}</s>,
  },
}
`)
    expect(annotation!.annotated).toBe(4)
    expect(annotation!.code).toContain(`link: ({children, value}) => {'use memo';`)
    expect(annotation!.code).toContain(
      `'strike-through': ({children}) => {'use memo';return (<s>{children}</s>);}`,
    )

    const satisfies = await annotate(`
import type {PortableTextComponents} from '@portabletext/react'

export const components = {
  marks: {link: ({children}) => <a>{children}</a>},
} satisfies PortableTextComponents
`)
    expect(satisfies!.annotated).toBe(1)

    const asCast = await annotate(`
import type {PortableTextComponents as PTC} from '@portabletext/react'

export const components = {
  marks: {link: ({children}) => <a>{children}</a>},
} as PTC
`)
    expect(asCast!.annotated).toBe(1)
  })

  test('ignores same-named types from other modules', async () => {
    const result = await annotate(`
import type {PortableTextComponents} from '@portabletext/svelte'

export const components: PortableTextComponents = {
  marks: {link: ({children}) => children},
}
`)
    expect(result).toBeNull()
  })
})

describe('directives and opt-outs', () => {
  test('never overrides an existing compiler directive', async () => {
    const result = await annotate(`
import {defineConfig} from 'sanity'

export default defineConfig({
  form: {
    components: {
      input: (props) => {
        'use no memo'
        return props.renderDefault(props)
      },
      field: (props) => {
        'use memo'
        return props.renderDefault(props)
      },
    },
  },
})
`)
    expect(result).toBeNull()
  })

  test('keeps other directives (like use strict) and prepends the opt-in', async () => {
    const result = await annotate(`
import {defineConfig} from 'sanity'

export default defineConfig({
  form: {
    components: {
      input: (props) => {
        'use strict'
        return props.renderDefault(props)
      },
    },
  },
})
`)
    expect(result!.code).toContain(`input: (props) => {'use memo';
        'use strict'`)
  })

  test('respects a module-level use no memo opt-out', async () => {
    const result = await annotate(`
'use no memo'
import {defineConfig} from 'sanity'

export default defineConfig({
  form: {components: {input: (props) => props.renderDefault(props)}},
})
`)
    expect(result).toBeNull()
  })
})

describe('result shape', () => {
  test('returns null when the module has no anchors at all', async () => {
    expect(await annotate(`export const foo = 1`)).toBeNull()
    expect(
      await annotate(`
import {defineConfig} from 'sanity'
export default defineConfig({name: 'default'})
`),
    ).toBeNull()
  })

  test('does not annotate identifier references (already compiler-visible)', async () => {
    const result = await annotate(`
import {defineConfig} from 'sanity'
import {CustomField} from './CustomField'

export default defineConfig({
  form: {components: {field: CustomField}},
})
`)
    expect(result).toBeNull()
  })

  test('produces a composable sourcemap', async () => {
    const result = await annotate(`
import {defineConfig} from 'sanity'

export default defineConfig({
  form: {components: {input: (props) => props.renderDefault(props)}},
})
`)
    expect(result!.map.mappings.length).toBeGreaterThan(0)
    expect(result!.map.sources).toEqual(['sanity.config.tsx'])
  })
})
