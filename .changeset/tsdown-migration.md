---
"@sanity/pkg-utils": major
---

Migrate from rollup/rolldown to tsdown for bundling

## Breaking Changes

- Removes `dts: 'api-extractor'` and `dts: 'rolldown'` config options - tsdown handles DTS automatically
- Removes `rollup` configuration object from config types  
- Moves `babel.reactCompiler` to top-level `reactCompiler` option
- Moves `babel.styledComponents` to top-level `styledComponents` option
- Moves `rollup.vanillaExtract` to top-level `vanillaExtract` option

## Features

- Added `reactCompiler: boolean | Partial<ReactCompilerOptions>` config option for React Compiler support with full plugin options
- Added `styledComponents` top-level config option using rolldown's built-in styled-components support
- Added `vanillaExtract` top-level config option using `@vanilla-extract/rollup-plugin`
- Added `tsgo` option for native TypeScript preview via `@typescript/native-preview`
- Implemented React Compiler using `@rollup/plugin-babel` as recommended by tsdown
- Replaced esbuild-based export validation with publint
- Consolidated JS and DTS generation under tsdown
- Retained api-extractor for TSDoc validation
- Warns when `babel-plugin-styled-components` is installed while using built-in support (in strict mode)
- Maintains backward-compatible chunk naming: chunks are emitted to `_chunks/` folder with stable names (no hashes by default)

## Performance

- Faster builds (~421ms vs previous ~800ms for pkg-utils)
- Simplified codebase (removed ~1200 lines of rollup/rolldown code)

## Dependencies

- **Added**: `tsdown@^0.16.8`, `publint@^0.3.15`, `@babel/preset-react@^7.28.5`
- **Removed**: `rollup`, `rolldown`, `rolldown-plugin-dts`, `esbuild`, `browserslist-to-esbuild`, and rollup plugins (except `@rollup/plugin-babel` for React Compiler)
