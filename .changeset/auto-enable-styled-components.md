---
"@sanity/pkg-utils": minor
---

Auto-enable styled-components compiler when detected as peer dependency. If `styled-components` is in peerDependencies and `babel-plugin-styled-components` is in devDependencies, the babel plugin is automatically enabled without requiring explicit configuration. Users can disable this behavior by setting `babel: { styledComponents: false }` in package.config.ts.
