const size = 10
const gap = 5

export function ColorSwatch({a, b, c, d}: {a: string; b: string; c: string; d: string}) {
  return (
    <svg
      data-sanity-icon
      width="1em"
      height="1em"
      viewBox="0 0 25 25"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width={size} height={size} rx="1" x="0" y="0" fill={a || 'currentColor'} />
      <rect width={size} height={size} rx="1" x="0" y={size + gap} fill={b || 'currentColor'} />
      <rect width={size} height={size} rx="1" x={size + gap} y="0" fill={c || 'currentColor'} />
      <rect
        width={size}
        height={size}
        rx="1"
        x={size + gap}
        y={size + gap}
        fill={d || 'currentColor'}
      />
    </svg>
  )
}
