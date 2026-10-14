export default {
  include: ['./src/**/*.ts'],
  outdir: 'styled-system',
  preflight: false,
  theme: {
    recipes: {
      badge: {className: 'badge', base: {fontWeight: 'bold'}},
    },
  },
}
