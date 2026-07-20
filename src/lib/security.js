// Password generation, hashing, and validation.
// NOTE: This is a client-only standalone app with no server (SRS 1.2).
// "Hashing" here is a lightweight obfuscation to avoid storing plaintext in
// localStorage — it is NOT a substitute for real server-side auth. The SRS
// itself notes there is no real access control in the standalone version.

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const LOWER = 'abcdefghijkmnpqrstuvwxyz'
const DIGITS = '23456789'
const SYMBOLS = '!@#$%&*?'

function pick(str) {
  return str[Math.floor(Math.random() * str.length)]
}

// Random 8-char alphanumeric + symbol (Addendum 17.1).
export function generatePassword() {
  const all = UPPER + LOWER + DIGITS + SYMBOLS
  // Guarantee at least one of each required class.
  let chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)]
  while (chars.length < 8) chars.push(pick(all))
  // shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

// Simple deterministic hash (djb2) — enough to avoid plaintext storage.
export function hashPassword(pw) {
  let h = 5381
  for (let i = 0; i < pw.length; i++) {
    h = (h * 33) ^ pw.charCodeAt(i)
  }
  // unsigned + salt marker
  return 'h1$' + (h >>> 0).toString(36)
}

export function verifyPassword(pw, hash) {
  return hashPassword(pw) === hash
}

// Password rules — Addendum 18.1.
export function validateNewPassword(newPw, { systemGenerated, previousHash } = {}) {
  const errors = []
  if (newPw.length < 8) errors.push('Minimum 8 characters')
  if (!/[0-9]/.test(newPw)) errors.push('Must include at least one number')
  if (!/[^A-Za-z0-9]/.test(newPw)) errors.push('Must include at least one special character')
  if (systemGenerated && newPw === systemGenerated) {
    errors.push('Cannot be the same as the system-generated password')
  }
  if (previousHash && hashPassword(newPw) === previousHash) {
    errors.push('Cannot be the same as the previous password')
  }
  return errors
}
