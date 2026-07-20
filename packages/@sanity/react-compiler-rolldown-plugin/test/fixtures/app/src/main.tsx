import {createElement} from 'react'
import {createRoot} from 'react-dom/client'
import config from './sanity.config.ts'

const container = document.getElementById('root')
if (container) {
  const Input = config.form.components.input
  createRoot(container).render(
    createElement(Input, {
      schemaType: {name: 'string'},
      value: 'hello',
      renderDefault: () => null,
    }),
  )
}
