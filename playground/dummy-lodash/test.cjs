const {id} = require('dummy-lodash')

// eslint-disable-next-line no-console
console.log('require', {id})

// eslint-disable-next-line no-console, no-shadow
import('dummy-lodash').then(({id}) => console.log('dynamic import', {id}))
