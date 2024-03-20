// the default import is not supported
// import styled from 'styled-components'
import {styled} from 'styled-components'

// import {Card} from 'styled-components-module'
import {Card as CardCjs} from './dist/index.cjs'
import {Card as CardEsm} from './dist/index.js'

// console.log({Card})
console.log(CardCjs === CardEsm, CardCjs({}), CardEsm({}), styled.div)
