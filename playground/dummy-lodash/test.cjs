const {id} = require('dummy-lodash')

console.log('require', {id})

import('dummy-lodash').then(({id: id2}) => console.log('dynamic import', {id: id2}))
