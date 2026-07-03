import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '../components/ui'
import { isValidNric } from '../lib/nric'

interface Props {
  onAuthenticated: (onboardingRequired: boolean) => void
}

export default function Login({ onAuthenticated }: Props) {
  const [nric, setNric] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!isValidNric(nric)) {
      setError('Please enter a valid NRIC/FIN.')
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/auth/nric', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nric, dateOfBirth }),
      })

      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.error ?? 'Something went wrong. Please try again.')
      }

      onAuthenticated(Boolean(body.onboardingRequired))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-full flex flex-col bg-white">
      {/* Gradient hero */}
      <div
        className="relative flex-shrink-0 h-56 overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #135555 0%, #1A7070 45%, #00897B 100%)' }}
      >
        <div
          className="absolute -top-10 -left-14 w-44 h-44 rounded-full"
          style={{ background: 'radial-gradient(circle at 30% 30%, #26C6DA, #00897B)', opacity: 0.5, filter: 'blur(2px)' }}
        />
        <div
          className="absolute -top-16 right-[-40px] w-52 h-52 rounded-full"
          style={{ background: 'radial-gradient(circle at 35% 35%, #E0F7F5, #80DEDB)', opacity: 0.3 }}
        />
        <div
          className="absolute bottom-[-70px] left-1/3 w-56 h-56 rounded-full"
          style={{ background: 'radial-gradient(circle at 35% 35%, #00B8A9, #135555)', opacity: 0.45 }}
        />

        <div className="relative z-10 h-full flex flex-col items-center justify-center gap-2 px-6 text-center">
          <img
            src="/healthkaki_logo.png"
            alt="HealthKaki"
            className="w-60 h-auto mb-1"
            style={{ filter: 'brightness(0) invert(1)' }}
          />
          <p className="text-white text-base font-semibold">
            Enter your NRIC/FIN and date of birth to continue
          </p>
        </div>
      </div>

      {/* Form sheet */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative z-10 -mt-6 flex-1 bg-white rounded-t-[28px] flex flex-col items-center px-5 pt-8 pb-10"
      >
        <div className="w-full max-w-sm">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="login-nric" className="block text-sm font-medium text-neutral-900">
                NRIC / FIN
              </label>
              <input
                id="login-nric"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                required
                maxLength={9}
                value={nric}
                onChange={(e) => setNric(e.target.value.toUpperCase().slice(0, 9))}
                placeholder="S1234567D"
                className="w-full min-h-[44px] px-4 py-2.5 text-base border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:border-teal-600 focus:ring-2 focus:ring-teal-200 outline-none uppercase"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="login-dob" className="block text-sm font-medium text-neutral-900">
                Date of birth
              </label>
              <input
                id="login-dob"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                required
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full min-h-[44px] px-4 py-2.5 text-base border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:border-teal-600 focus:ring-2 focus:ring-teal-200 outline-none"
              />
            </div>

            {error && (
              <div role="alert" className="bg-danger-50 border border-danger-400/30 rounded-xl px-4 py-3">
                <p className="text-sm text-danger-500">{error}</p>
              </div>
            )}

            <Button type="submit" variant="primary" fullWidth disabled={submitting}>
              {submitting ? 'Checking…' : 'Continue'}
            </Button>
          </form>

          <div className="mt-5 bg-teal-50 border border-teal-100 rounded-xl px-4 py-3">
            <p className="text-center text-s text-teal-700">
              First time here? Just enter your details above — we&apos;ll set up your account automatically.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
