import type {PortableTextComponents} from '@portabletext/react'
import {defineType} from 'sanity'

export const portableTextComponents: PortableTextComponents = {
  marks: {
    link: ({children, value}) => {
      const rel = !value.href.startsWith('/') ? 'noreferrer noopener' : undefined
      return (
        <a href={value.href} rel={rel}>
          {children}
        </a>
      )
    },
  },
}

export const myType = defineType({
  name: 'myType',
  type: 'string',
  components: {
    input: (props) => props.renderDefault(props),
  },
})
