const {id} = require('dummy-lodash')

console.log('require', {id})

import('dummy-lodash').then(({id}) => console.log('dynamic import', {id}))
