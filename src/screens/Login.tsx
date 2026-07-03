import { useState } from 'react'
import { Card, Button } from '../components/ui'
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
    <div className="min-h-full bg-neutral-50 flex flex-col items-center px-5 py-10">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-neutral-900 text-center mb-1">Welcome to HealthKaki</h1>
        <p className="text-sm text-neutral-500 text-center mb-6">
          Enter your NRIC/FIN and date of birth to continue
        </p>

        <Card className="p-6">
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
              <p role="alert" className="text-sm text-danger-500">{error}</p>
            )}

            <Button type="submit" variant="primary" fullWidth disabled={submitting}>
              {submitting ? 'Checking…' : 'Continue'}
            </Button>
          </form>
        </Card>

        <p className="text-center text-xs text-neutral-400 mt-5">
          First time here? Just enter your details above — we&apos;ll set up your account automatically.
        </p>
      </div>
    </div>
  )
}
