// Amount in words — supports both international (Million/Billion) and
// Bangladesh (Lac/Crore) numbering (SRS 4.3 "supports BD Lac/Crore numbering").

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigits(n) {
  if (n < 20) return ONES[n]
  const t = Math.floor(n / 10)
  const o = n % 10
  return TENS[t] + (o ? ' ' + ONES[o] : '')
}

function threeDigits(n) {
  const h = Math.floor(n / 100)
  const rest = n % 100
  let out = ''
  if (h) out += ONES[h] + ' Hundred'
  if (rest) out += (h ? ' ' : '') + twoDigits(rest)
  return out
}

// Bangladesh system: crore, lac, thousand, hundred
function bdWords(num) {
  if (num === 0) return 'Zero'
  const parts = []
  const crore = Math.floor(num / 10000000)
  num %= 10000000
  const lac = Math.floor(num / 100000)
  num %= 100000
  const thousand = Math.floor(num / 1000)
  num %= 1000
  const hundredsBlock = num

  if (crore) parts.push(bdWords(crore) + ' Crore')
  if (lac) parts.push(twoDigits(lac) + ' Lac')
  if (thousand) parts.push(twoDigits(thousand) + ' Thousand')
  if (hundredsBlock) parts.push(threeDigits(hundredsBlock))
  return parts.join(' ').trim()
}

// International system: billion, million, thousand
function intlWords(num) {
  if (num === 0) return 'Zero'
  const parts = []
  const billion = Math.floor(num / 1000000000)
  num %= 1000000000
  const million = Math.floor(num / 1000000)
  num %= 1000000
  const thousand = Math.floor(num / 1000)
  num %= 1000
  const hundredsBlock = num

  if (billion) parts.push(threeDigits(billion) + ' Billion')
  if (million) parts.push(threeDigits(million) + ' Million')
  if (thousand) parts.push(threeDigits(thousand) + ' Thousand')
  if (hundredsBlock) parts.push(threeDigits(hundredsBlock))
  return parts.join(' ').trim()
}

const CURRENCY_UNITS = {
  USD: { major: 'Dollars', minor: 'Cents' },
  BDT: { major: 'Taka', minor: 'Paisa' },
  EUR: { major: 'Euros', minor: 'Cents' },
  GBP: { major: 'Pounds', minor: 'Pence' },
  AED: { major: 'Dirhams', minor: 'Fils' },
}

export function amountInWords(amount, currency = 'USD') {
  const value = Number(amount) || 0
  const negative = value < 0
  const abs = Math.abs(value)
  const major = Math.floor(abs)
  const minor = Math.round((abs - major) * 100)

  // BD numbering for BDT; international otherwise.
  const wordFn = currency === 'BDT' ? bdWords : intlWords
  const units = CURRENCY_UNITS[currency] || { major: '', minor: '' }

  let words = wordFn(major)
  if (units.major) words += ' ' + units.major
  if (minor > 0) {
    words += ' and ' + twoDigits(minor) + (units.minor ? ' ' + units.minor : '')
  }
  words += ' Only'
  return (negative ? 'Minus ' : '') + words.replace(/\s+/g, ' ').trim()
}
