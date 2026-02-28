const {id} = require('dummy-lodash-es')

console.log('require', {id})

import('dummy-lodash-es').then(({id: id2}) => console.log('dynamic import', {id: id2}))
