import { useRef, useEffect } from 'react'

// Textarea that auto-grows to fit its content (SRS 4.2 — description auto-grows).
export default function AutoTextarea({ value, onChange, className = 'textarea', minHeight = 38, style, ...rest }) {
  const ref = useRef(null)

  const resize = () => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.max(minHeight, el.scrollHeight) + 'px'
  }

  useEffect(resize, [value])

  return (
    <textarea
      ref={ref}
      className={className}
      value={value}
      onChange={(e) => {
        onChange(e)
        resize()
      }}
      style={{ minHeight, resize: 'none', overflow: 'hidden', ...style }}
      {...rest}
    />
  )
}
