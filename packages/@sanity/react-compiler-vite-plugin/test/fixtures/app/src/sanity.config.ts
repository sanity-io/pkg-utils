// `sanity` resolves to the local stub (Vite alias + tsconfig paths): the fixture only needs
// the import specifier to match the allow-listed surface, not the real Studio.
import {createElement} from 'react'
import {defineConfig} from 'sanity'
import {CustomStringInput} from './CustomStringInput.tsx'

export default defineConfig({
  name: 'default',
  form: {
    components: {
      input: (props) =>
        props.schemaType?.name === 'string'
          ? createElement(CustomStringInput, props)
          : props.renderDefault(props),
    },
  },
})
