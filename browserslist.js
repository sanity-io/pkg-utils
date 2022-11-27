'use strict'

/**
 * Shared browserslist configuration.
 * This allows us to share the same browserslist config between projects.
 * To use this config, add the following to your package.json:
 * ```json
 * "browserslist": [
 *  "extends @sanity/pkg-utils/browserslist"
 * ]
 * ```
 * Docs: https://github.com/browserslist/browserslist#shareable-configs
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
module.exports = require('./dist/index').DEFAULT_BROWSERSLIST_QUERY
