import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import { Card, Button } from '../components/ui'
import type { Profile } from '../types'
import { CITIZENSHIP_OPTIONS, INCOME_OPTIONS, type CitizenshipStatus } from '../lib/profile-options'

interface Props {
  onComplete: (profile: Profile) => void
}

export default function Onboarding({ onComplete }: Props) {
  const [fullName, setFullName] = useState('')
  const [citizenshipStatus, setCitizenshipStatus] = useState<CitizenshipStatus | ''>('')
  const [citizenshipYear, setCitizenshipYear] = useState('')
  const [householdIncome, setHouseholdIncome] = useState('')
  const [householdSize, setHouseholdSize] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [savedProfile, setSavedProfile] = useState<Profile | null>(null)

  const showCitizenshipYear = citizenshipStatus === 'citizen' || citizenshipStatus === 'pr'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!citizenshipStatus) {
      setError('Please select your citizenship status.')
      return
    }
    if (!householdIncome) {
      setError('Please select your household monthly income.')
      return
    }
    if (!householdSize) {
      setError('Please enter your household size.')
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName || null,
          citizenship_status: citizenshipStatus,
          citizenship_year: citizenshipYear ? Number(citizenshipYear) : null,
          household_monthly_income: Number(householdIncome),
          household_size: Number(householdSize),
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to save your profile')
      }

      const { profile } = (await res.json()) as { profile: Profile }
      setSavedProfile(profile)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-full bg-neutral-50 flex flex-col items-center px-5 py-10">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-neutral-900 text-center mb-1">Tell us about you</h1>
        <p className="text-sm text-neutral-500 text-center mb-6">
          This helps us find the subsidies you&apos;re eligible for.
        </p>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="ob-full-name" className="block text-sm font-medium text-neutral-900">
                Full name
              </label>
              <input
                id="ob-full-name"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full min-h-[44px] px-4 py-2.5 text-base border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:border-teal-600 focus:ring-2 focus:ring-teal-200 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="ob-citizenship" className="block text-sm font-medium text-neutral-900">
                Citizenship status <span aria-hidden="true">*</span>
              </label>
              <select
                id="ob-citizenship"
                required
                value={citizenshipStatus}
                onChange={(e) => setCitizenshipStatus(e.target.value as CitizenshipStatus)}
                className="w-full min-h-[44px] px-4 py-2.5 text-base border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:border-teal-600 focus:ring-2 focus:ring-teal-200 outline-none"
              >
                <option value="" disabled>Select one</option>
                {CITIZENSHIP_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {showCitizenshipYear && (
              <div className="space-y-1.5">
                <label htmlFor="ob-citizenship-year" className="block text-sm font-medium text-neutral-900">
                  Year you became a {citizenshipStatus === 'citizen' ? 'citizen' : 'PR'} (optional)
                </label>
                <input
                  id="ob-citizenship-year"
                  type="number"
                  inputMode="numeric"
                  min={1900}
                  max={new Date().getFullYear()}
                  value={citizenshipYear}
                  onChange={(e) => setCitizenshipYear(e.target.value)}
                  className="w-full min-h-[44px] px-4 py-2.5 text-base border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:border-teal-600 focus:ring-2 focus:ring-teal-200 outline-none"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="ob-income" className="block text-sm font-medium text-neutral-900">
                Household monthly income, $ <span aria-hidden="true">*</span>
              </label>
              <select
                id="ob-income"
                required
                value={householdIncome}
                onChange={(e) => setHouseholdIncome(e.target.value)}
                className="w-full min-h-[44px] px-4 py-2.5 text-base border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:border-teal-600 focus:ring-2 focus:ring-teal-200 outline-none"
              >
                <option value="" disabled>Select a range</option>
                {INCOME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="ob-household-size" className="block text-sm font-medium text-neutral-900">
                Household size <span aria-hidden="true">*</span>
              </label>
              <input
                id="ob-household-size"
                type="number"
                inputMode="numeric"
                required
                min={1}
                value={householdSize}
                onChange={(e) => setHouseholdSize(e.target.value)}
                className="w-full min-h-[44px] px-4 py-2.5 text-base border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:border-teal-600 focus:ring-2 focus:ring-teal-200 outline-none"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-danger-500">{error}</p>
            )}

            <Button type="submit" variant="primary" fullWidth disabled={submitting}>
              {submitting ? 'Saving…' : 'Continue'}
            </Button>
          </form>
        </Card>
      </div>

      <AnimatePresence>
        {savedProfile && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="registration-success-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="w-full max-w-sm bg-white rounded-2xl p-6 text-center"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            >
              <motion.div
                className="mx-auto mb-4 w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 18, delay: 0.1 }}
              >
                <CheckCircle2 className="w-9 h-9 text-teal-700" strokeWidth={2} />
              </motion.div>
              <h2 id="registration-success-title" className="text-xl font-bold text-neutral-900 mb-1">
                Registration successful!
              </h2>
              <p className="text-sm text-neutral-500 mb-6">
                Your profile has been saved. You&apos;re all set to start scanning documents.
              </p>
              <Button variant="primary" fullWidth onClick={() => onComplete(savedProfile)}>
                Get Started
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
