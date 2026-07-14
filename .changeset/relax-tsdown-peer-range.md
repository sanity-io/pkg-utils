---
'@sanity/tsdown-config': patch
---

Relax the `tsdown` peer dependency from an exact pin (`0.22.5`) to a range (`^0.22.5`), so newer `tsdown` patch releases like `0.22.7` no longer trigger unresolved peer dependency warnings on install.
