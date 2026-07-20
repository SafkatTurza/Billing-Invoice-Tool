import { useState, useRef } from 'react'
import { putAttachment, deleteAttachment, getAttachmentURL, formatBytes, MAX_FILE_BYTES } from '../lib/attachments.js'
import { useApp } from '../context/AppContext.jsx'
import { useToast } from './Toast.jsx'
import { Icon } from './Icons.jsx'

// Reusable attachment uploader. `value` is an array of attachment metadata
// ({id,name,mime,size,...}); `onChange` receives the updated array.
// Supports multiple files, 2 MB each (images auto-compressed).
export default function AttachmentField({ value = [], onChange, label = 'Supporting Documents' }) {
  const { currentUser } = useApp()
  const toast = useToast()
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)

  const addFiles = async (files) => {
    setBusy(true)
    const added = []
    for (const file of Array.from(files)) {
      // Cheap pre-check for non-images (images get compressed, so we let those through).
      if (!/^image\//.test(file.type) && file.size > MAX_FILE_BYTES) {
        toast.error(`"${file.name}" is over the 2 MB limit.`)
        continue
      }
      try {
        const meta = await putAttachment(file, { uploadedBy: currentUser?.fullName })
        added.push(meta)
      } catch (err) {
        toast.error(err.message)
      }
    }
    if (added.length) onChange([...value, ...added])
    setBusy(false)
  }

  const remove = async (id) => {
    await deleteAttachment(id)
    onChange(value.filter((a) => a.id !== id))
  }

  const open = async (id) => {
    const url = await getAttachmentURL(id)
    if (url) window.open(url, '_blank', 'noopener')
  }

  return (
    <div className="field">
      <label>{label}</label>
      <div
        className="attach-drop"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
      >
        <Icon.download width={18} height={18} style={{ transform: 'rotate(180deg)' }} />
        <span>{busy ? 'Uploading…' : 'Click or drop files — PDF or image, max 2 MB each'}</span>
        <input
          ref={inputRef}
          type="file"
          hidden
          multiple
          accept="image/*,application/pdf"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {value.length > 0 && (
        <div className="attach-list">
          {value.map((a) => (
            <div key={a.id} className="attach-item">
              <span className="attach-ico">
                {/^image\//.test(a.mime) ? <Icon.eye width={15} height={15} /> : <Icon.invoice width={15} height={15} />}
              </span>
              <span className="attach-name" onClick={() => open(a.id)} title="Open">
                {a.name}
              </span>
              <span className="attach-size">{formatBytes(a.size)}</span>
              <button className="attach-x" onClick={() => remove(a.id)} aria-label="Remove">
                <Icon.x width={14} height={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Read-only list for the preview page.
export function AttachmentList({ value = [] }) {
  const open = async (id) => {
    const url = await getAttachmentURL(id)
    if (url) window.open(url, '_blank', 'noopener')
  }
  if (!value.length) return null
  return (
    <div className="attach-list">
      {value.map((a) => (
        <div key={a.id} className="attach-item">
          <span className="attach-ico">
            <Icon.invoice width={15} height={15} />
          </span>
          <span className="attach-name" onClick={() => open(a.id)}>
            {a.name}
          </span>
          <span className="attach-size">{formatBytes(a.size)}</span>
        </div>
      ))}
    </div>
  )
}
