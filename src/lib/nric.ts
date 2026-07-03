// Singapore NRIC/FIN validation: format + official checksum digit.
// Reference: the standard 2-7-6-5-4-3-2 weighted-sum algorithm used for
// S/T (citizens/PR) and F/G (foreigners) prefixes.
const WEIGHTS = [2, 7, 6, 5, 4, 3, 2] as const
const ST_TABLE = ['J', 'Z', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'] as const
const FG_TABLE = ['X', 'W', 'U', 'T', 'R', 'Q', 'P', 'N', 'M', 'L', 'K'] as const

export function isValidNric(value: string): boolean {
  const nric = value.trim().toUpperCase()
  if (!/^[STFGM]\d{7}[A-Z]$/.test(nric)) return false

  const prefix = nric[0]

  // The newer M-series FIN (introduced 2022) uses a different checksum
  // table that isn't implemented here — format is validated, checksum isn't.
  if (prefix === 'M') return true

  const digits = nric.slice(1, 8).split('').map(Number)
  let sum = digits.reduce((acc, d, i) => acc + d * WEIGHTS[i], 0)
  if (prefix === 'T' || prefix === 'G') sum += 4

  const remainder = sum % 11
  const table = prefix === 'S' || prefix === 'T' ? ST_TABLE : FG_TABLE

  return nric[8] === table[remainder]
}
