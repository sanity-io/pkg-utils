/** @type {import('jest').Config} */
export default {
  // Jest's node environment is the point of this fixture: it must resolve the
  // producer's `bundle.css` export to the JS shim. The smoke test is plain JS
  // because ts-jest cannot load TypeScript 7 (no JavaScript compiler API).
  testEnvironment: 'node',
}
