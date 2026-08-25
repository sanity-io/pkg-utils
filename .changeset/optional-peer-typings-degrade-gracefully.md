---
'@sanity/tsdown-config': patch
---

Installing only one of the optional React Compiler packages no longer breaks `defineConfig()`'s types. The missing package's typings used to degrade to `any` and collapse the `ReactCompilerOptions` union, so every `reactCompiler` config resolved to the `reactServer: true` overload (`Promise<UserConfig[]>`) unless consumers stubbed the missing module. Now the uninstalled branch degrades to just `transform`/`reactServer` while the installed one keeps its real typings — stubs like sanity-io/ui's `typings/babel-plugin-react-compiler.d.ts` can be deleted.
