import { useRef, useState, useEffect } from 'react'
import { Icon } from './Icons.jsx'

// Lets a user capture their signature — either draw it on a canvas or upload
// an image. Returns a trimmed PNG data URL via onSave. Stored on the user
// profile and reused to sign/approve documents.
export default function SignaturePad({ initial, onSave, onClose }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const [mode, setMode] = useState('draw') // draw | upload
  const [uploaded, setUploaded] = useState(initial || '')

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.strokeStyle = '#111'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [mode])

  const pos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const t = e.touches ? e.touches[0] : e
    return { x: t.clientX - rect.left, y: t.clientY - rect.top }
  }
  const start = (e) => {
    drawing.current = true
    const { x, y } = pos(e)
    const ctx = canvasRef.current.getContext('2d')
    ctx.beginPath()
    ctx.moveTo(x, y)
  }
  const move = (e) => {
    if (!drawing.current) return
    e.preventDefault()
    const { x, y } = pos(e)
    const ctx = canvasRef.current.getContext('2d')
    ctx.lineTo(x, y)
    ctx.stroke()
  }
  const end = () => {
    drawing.current = false
  }
  const clear = () => {
    const c = canvasRef.current
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, c.width, c.height)
  }

  const onUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setUploaded(reader.result)
    reader.readAsDataURL(file)
  }

  const save = () => {
    if (mode === 'upload') {
      if (uploaded) onSave(uploaded)
      return
    }
    onSave(canvasRef.current.toDataURL('image/png'))
  }

  return (
    <div>
      <div className="row gap-8 mb-16">
        <button className={`btn btn-sm ${mode === 'draw' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode('draw')}>
          Draw
        </button>
        <button className={`btn btn-sm ${mode === 'upload' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode('upload')}>
          Upload Image
        </button>
      </div>

      {mode === 'draw' ? (
        <div>
          <canvas
            ref={canvasRef}
            width={440}
            height={160}
            style={{ border: '1px solid var(--border-primary)', borderRadius: 8, width: '100%', touchAction: 'none', cursor: 'crosshair' }}
            onMouseDown={start}
            onMouseMove={move}
            onMouseUp={end}
            onMouseLeave={end}
            onTouchStart={start}
            onTouchMove={move}
            onTouchEnd={end}
          />
          <button className="btn btn-ghost btn-sm mt-8" onClick={clear}>
            <Icon.x width={13} height={13} /> Clear
          </button>
        </div>
      ) : (
        <div>
          <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
            <Icon.download width={15} height={15} /> Choose signature image
            <input type="file" accept="image/*" hidden onChange={onUpload} />
          </label>
          {uploaded && (
            <div style={{ marginTop: 12, border: '1px solid var(--border-primary)', borderRadius: 8, padding: 10, background: '#fff' }}>
              <img src={uploaded} alt="signature" style={{ maxHeight: 90, maxWidth: '100%' }} />
            </div>
          )}
        </div>
      )}

      <div className="row gap-8 mt-16" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={save}>
          <Icon.check width={15} height={15} /> Save Signature
        </button>
      </div>
    </div>
  )
}
