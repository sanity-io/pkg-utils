const {id} = require('dummy-lodash-es')

console.log('require', {id})

import('dummy-lodash-es').then(({id}) => console.log('dynamic import', {id}))
