<script lang="ts">
  import { onMount } from 'svelte'
  import {
    enableVisualEditing,
    type HistoryAdapterNavigate,
  } from '@sanity/visual-editing'
  import { afterNavigate, goto } from '$app/navigation'
  import type { VisualEditingProps } from './types.js'

  export let zIndex: VisualEditingProps['zIndex'] = undefined

  let navigate: HistoryAdapterNavigate | undefined
  let navigatingFromUpdate = false

  onMount(() =>
    enableVisualEditing({
      zIndex,
      history: {
        subscribe: (_navigate) => {
          navigate = _navigate
          // Initial navigation
          navigate({
            type: 'replace',
            url: window.location.pathname + window.location.search,
          })
          return () => {
            navigate = undefined
          }
        },
        update: (update) => {
          if (update.type === 'push' || update.type === 'replace') {
            navigatingFromUpdate = true
            goto(update.url, { replaceState: update.type === 'replace' })
          } else if (update.type === 'pop') {
            history.back()
          }
        },
      },
    }),
  )

  afterNavigate(async ({ to, complete }) => {
    if (navigate && to && !navigatingFromUpdate) {
      await complete
      navigate({ type: 'push', url: to.url.pathname + to.url.search })
    }
    navigatingFromUpdate = false
  })
</script>
