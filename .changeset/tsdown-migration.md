---
"@sanity/pkg-utils": major
---

Migrate from rollup/rolldown to tsdown for bundling

## Breaking Changes

- Removes `dts: 'api-extractor'` and `dts: 'rolldown'` config options - tsdown handles DTS automatically
- Removes `rollup` configuration object from config types  
- Moves `babel.reactCompiler` to top-level `reactCompiler` option
- Moves `tsgo` option to `tsdown.tsgo`

## Features

- Added `reactCompiler: boolean | Partial<ReactCompilerOptions>` config option for React Compiler support with full plugin options
- Added `tsdown.tsgo` option for native TypeScript preview via `@typescript/native-preview`
- Implemented React Compiler using `@rollup/plugin-babel` as recommended by tsdown
- Replaced esbuild-based export validation with publint
- Consolidated JS and DTS generation under tsdown
- Retained api-extractor for TSDoc validation

## Performance

- Faster builds (~421ms vs previous ~800ms for pkg-utils)
- Simplified codebase (removed ~1200 lines of rollup/rolldown code)

## Dependencies

- **Added**: `tsdown@0.15.12`, `publint@^0.3.15`, `@babel/preset-react@^7.28.5`
- **Removed**: `rollup`, `rolldown`, `rolldown-plugin-dts`, `esbuild`, `browserslist-to-esbuild`, and rollup plugins (except `@rollup/plugin-babel` for React Compiler)
