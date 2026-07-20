// Client code generation — format: DCS26-RE-SHL-001
// (companyCode + 2-digit year + industry field + name abbreviation + sequence)
// Ported from the original Paynox source.

import { ls, KEYS } from './storage.js'

export const CLIENT_FIELDS = [
  ['RE', 'Real Estate'],
  ['3D', '3D Asset Development'],
  ['GD', 'Game Development'],
  ['AV', 'Animation / AV'],
  ['AR', 'Architecture'],
  ['AD', 'Advertising / Media'],
  ['IT', 'IT / Software'],
  ['GEN', 'General'],
]

export function codeAbbrev(name) {
  const n = (name || '').trim()
  if (!n) return 'XXX'
  let a = n.replace(/[^A-Z]/g, '') // "Shanta Holdings Ltd." → SHL
  if (a.length < 2) a = n.split(/\s+/).map((w) => w[0]).join('').toUpperCase() // "john doe" → JD
  if (a.length < 2) a = n.slice(0, 3).toUpperCase()
  return a.slice(0, 4)
}

function nextClientSeq(clients) {
  let mx = parseInt(ls.get(KEYS.clientSeq, 0) || 0, 10) || 0
  ;(clients || []).forEach((c) => {
    const m = /(\d+)\s*$/.exec(c.code || '')
    if (m) mx = Math.max(mx, parseInt(m[1], 10))
  })
  return mx + 1
}

export function genClientCode(company, field, name, clients) {
  const coCode = ((company && (company.code || codeAbbrev(company.name))) || 'DCS')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  const yy = String(new Date().getFullYear()).slice(-2)
  const seq = nextClientSeq(clients)
  return `${coCode}${yy}-${(field || 'GEN').toUpperCase()}-${codeAbbrev(name)}-${String(seq).padStart(3, '0')}`
}

// Commit the sequence (called when a coded client is actually saved).
export function commitClientSeq(clients) {
  const seq = nextClientSeq(clients)
  ls.set(KEYS.clientSeq, seq)
  return seq
}
