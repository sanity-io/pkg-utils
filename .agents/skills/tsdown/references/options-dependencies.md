---
name: options-dependencies
description: tsdown dependency handling - deps.neverBundle, deps.alwaysBundle, bundling behavior
---

# Dependencies

## Default Behavior

### External (not bundled)

- **`dependencies`** - Installed automatically by package managers
- **`peerDependencies`** - Expected to be installed by consumers

### Bundled (if used)

- **`devDependencies`** - Only if actually imported in source code
- **Phantom dependencies** - Unlisted deps in node_modules, only if used

## Skip All Node Modules

Prevent bundling any dependencies from `node_modules`:

```ts
import {defineConfig} from 'tsdown'

export default defineConfig({
  deps: {
    skipNodeModulesBundle: true,
  },
})
```

## Customizing Dependencies

### Mark as External (Never Bundle)

```ts
import {defineConfig} from 'tsdown'

export default defineConfig({
  deps: {
    neverBundle: ['lodash', /^@my-scope\//],
  },
})
```

Also via CLI:

```bash
tsdown --deps.never-bundle lodash
```

### Force Bundle (Always Bundle)

Bundle dependencies even if listed in `dependencies`/`peerDependencies`:

```ts
import {defineConfig} from 'tsdown'

export default defineConfig({
  deps: {
    alwaysBundle: ['some-package'],
  },
})
```

## Declaration Files

Same bundling logic applies to `.d.ts` files. For complex third-party types:

```ts
import {defineConfig} from 'tsdown'

export default defineConfig({
  dts: {
    resolver: 'tsc', // Use TypeScript resolver for better compatibility
  },
})
```

## Summary

| Dependency Type    | Default Behavior |
| ------------------ | ---------------- |
| `dependencies`     | External         |
| `peerDependencies` | External         |
| `devDependencies`  | Bundled if used  |
| Phantom deps       | Bundled if used  |

<!--
Source references:
- https://tsdown.dev/options/dependencies
-->
