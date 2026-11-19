import {box} from './box.css.ts'
import {createHelperStyles} from './helpers.css.ts'

document.body.className = box
document.head.append(
  Object.assign(document.createElement('style'), {textContent: createHelperStyles('main')}),
)
