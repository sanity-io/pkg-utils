<template>
  <div>
    <h1>@css-playground/nuxt</h1>
    <div id="react-root" />
  </div>
</template>

<script setup lang="ts">
import {onMounted} from 'vue'

// Nuxt is Vue, so the producer's React component is mounted client-side via its `renderInto` helper
// (authored with React JSX, using the react-dom createRoot API internally). The dynamic import pulls
// the package into the client bundle, where the browser condition resolves the self-referential
// import to the real CSS.
onMounted(async () => {
  const {renderInto} = await import('sanity-css-vanilla-extract-test')
  const el = document.getElementById('react-root')
  if (el) await renderInto(el)
})
</script>
