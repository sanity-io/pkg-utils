import plainCss from './Styles.css.js'
import {button} from './button.css.ts'
import {box} from './styles.css.ts'

document.body.className = `${box} ${button}`
document.body.dataset['plainCss'] = plainCss
