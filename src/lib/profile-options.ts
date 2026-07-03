import type { Profile } from '../types'

export type CitizenshipStatus = NonNullable<Profile['citizenship_status']>

export const CITIZENSHIP_OPTIONS: { value: CitizenshipStatus; label: string }[] = [
  { value: 'citizen', label: 'Singapore Citizen' },
  { value: 'pr', label: 'Permanent Resident' },
  { value: 'foreigner', label: 'Foreigner' },
]

// Representative value used for eligibility calculations is the midpoint of
// each bracket (top bracket uses a conservative high estimate).
export const INCOME_OPTIONS: { value: number; label: string }[] = [
  { value: 1000, label: 'Below $1,500' },
  { value: 2250, label: '$1,500 – $2,999' },
  { value: 3750, label: '$3,000 – $4,499' },
  { value: 5250, label: '$4,500 – $5,999' },
  { value: 7000, label: '$6,000 – $7,999' },
  { value: 9000, label: '$8,000 – $9,999' },
  { value: 12000, label: '$10,000 and above' },
]
