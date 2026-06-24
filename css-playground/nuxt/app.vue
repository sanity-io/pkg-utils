<template>
  <div>
    <h1>@css-playground/nuxt</h1>
    <div id="react-root" />
  </div>
</template>

<script setup lang="ts">
import {onMounted} from 'vue'

// Nuxt is Vue, so the producer's React component is mounted client-side via the react-dom createRoot
// API. The dynamic imports pull the package into the client bundle, where the browser condition
// resolves the self-referential import to the real CSS.
onMounted(async () => {
  const {createElement} = await import('react')
  const {createRoot} = await import('react-dom/client')
  const {TestComponent} = await import('sanity-css-vanilla-extract-test')
  const el = document.getElementById('react-root')
  if (el) createRoot(el).render(createElement(TestComponent))
})
</script>
