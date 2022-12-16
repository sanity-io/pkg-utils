import * as commonjs from 'dummy-commonjs'
import * as module from 'dummy-module'

const rootElement = document.querySelector('#root')

if (rootElement) {
  rootElement.innerHTML = `<pre>${JSON.stringify({commonjs, module}, null, 2)}</pre>`
}
